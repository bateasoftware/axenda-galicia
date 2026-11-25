// Dónde se guardan los contadores: la misma base de datos que los eventos (Turso o Supabase).
// Sin base de datos configurada no falla: simplemente no registra (y los informes salen vacíos).
import type { Client } from "@libsql/client";
import { clienteTurso, tursoConfigurado } from "../almacen/turso";
import { supabaseConfigurado } from "../almacen/supabase";
import type { Fila } from "./modelo";

export const ESQUEMA_METRICAS_TURSO = `
CREATE TABLE IF NOT EXISTS metricas (
  dia    TEXT NOT NULL,
  ambito TEXT NOT NULL,
  clave  TEXT NOT NULL,
  tipo   TEXT NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, ambito, clave, tipo)
);
CREATE INDEX IF NOT EXISTS metricas_ambito ON metricas (ambito, clave, dia);
`;

export type AlmacenMetricas = {
  registrar(filas: Fila[]): Promise<void>;
  /** Filas desde un día (incluido); con `ambito` y `clave`, solo esas */
  leer(desde: string, filtro?: { ambito?: Fila["ambito"]; clave?: string }): Promise<Fila[]>;
};

export function metricasTurso(cliente: () => Promise<Client>): AlmacenMetricas {
  let listo: Promise<Client> | null = null;
  const db = () =>
    (listo ??= cliente().then(async (c) => {
      await c.executeMultiple(ESQUEMA_METRICAS_TURSO);
      return c;
    }));
  return {
    async registrar(filas) {
      if (!filas.length) return;
      await (await db()).batch(
        filas.map((f) => ({
          sql: "INSERT INTO metricas (dia, ambito, clave, tipo, n) VALUES (?, ?, ?, ?, ?) ON CONFLICT (dia, ambito, clave, tipo) DO UPDATE SET n = n + excluded.n",
          args: [f.dia, f.ambito, f.clave, f.tipo, f.n],
        })),
        "write",
      );
    },
    async leer(desde, filtro = {}) {
      const cond = ["dia >= ?"];
      const args: string[] = [desde];
      if (filtro.ambito) {
        cond.push("ambito = ?");
        args.push(filtro.ambito);
      }
      if (filtro.clave) {
        cond.push("clave = ?");
        args.push(filtro.clave);
      }
      const r = await (await db()).execute({ sql: `SELECT dia, ambito, clave, tipo, n FROM metricas WHERE ${cond.join(" AND ")}`, args });
      return r.rows.map((x) => ({ dia: String(x.dia), ambito: x.ambito as Fila["ambito"], clave: String(x.clave), tipo: x.tipo as Fila["tipo"], n: Number(x.n) }));
    },
  };
}

export function metricasSupabase({ url, clave }: { url: string; clave: string }): AlmacenMetricas {
  const base = url.replace(/\/$/, "");
  const cab: Record<string, string> = { apikey: clave, ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}), "Content-Type": "application/json" };
  return {
    async registrar(filas) {
      if (!filas.length) return;
      // Suma atómica en la base de datos (función sumar_metricas de supabase/esquema.sql)
      const res = await fetch(`${base}/rest/v1/rpc/sumar_metricas`, { method: "POST", headers: cab, body: JSON.stringify({ filas }) });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
    async leer(desde, filtro = {}) {
      const q = [`dia=gte.${desde}`, "select=dia,ambito,clave,tipo,n", "limit=50000"];
      if (filtro.ambito) q.push(`ambito=eq.${encodeURIComponent(filtro.ambito)}`);
      if (filtro.clave) q.push(`clave=eq.${encodeURIComponent(filtro.clave)}`);
      const res = await fetch(`${base}/rest/v1/metricas?${q.join("&")}`, { headers: cab, cache: "no-store" });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return ((await res.json()) as Fila[]).map((f) => ({ ...f, dia: String(f.dia).slice(0, 10), n: Number(f.n) }));
    },
  };
}

/** El almacén de métricas configurado, o null si no hay base de datos (entonces no se registra nada) */
export function almacenMetricas(env: Record<string, string | undefined> = process.env): AlmacenMetricas | null {
  if (tursoConfigurado(env)) return metricasTurso(() => clienteTurso(env));
  if (supabaseConfigurado(env)) return metricasSupabase({ url: env.SUPABASE_URL!, clave: env.SUPABASE_SERVICE_ROLE_KEY! });
  return null;
}
