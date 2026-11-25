// Cálculos para los informes (/admin/estadisticas, informe por organizador y /anunciate).
import { createHmac, timingSafeEqual } from "node:crypto";
import { lunes } from "../admin/cobertura";
import { sumarDias } from "../fechas";
import { sumarPor, TIPOS, type Ambito, type Fila, type TipoMetrica } from "./modelo";

export type Totales = Record<TipoMetrica, number>;
export const totalesVacios = (): Totales => Object.fromEntries(TIPOS.map((t) => [t, 0])) as Totales;

/** Totales de un ámbito (por defecto, los de toda la web) */
export function totales(filas: Fila[], ambito: Ambito = "total", clave?: string): Totales {
  const t = totalesVacios();
  for (const f of filas) if (f.ambito === ambito && (clave === undefined || f.clave === clave)) t[f.tipo] += f.n;
  return t;
}

/** Ranking de un ámbito, ordenado por un tipo (por defecto, visitas a la ficha) */
export function ranking(filas: Fila[], ambito: Ambito, orden: TipoMetrica = "vista"): { clave: string; t: Totales }[] {
  return [...sumarPor(filas, (f) => (f.ambito === ambito ? f.clave : null)).entries()]
    .map(([clave, t]) => ({ clave, t }))
    .sort((a, b) => b.t[orden] - a.t[orden] || b.t.impresion - a.t.impresion || a.clave.localeCompare(b.clave));
}

/** Evolución semanal (lunes a domingo) de las últimas `n` semanas hasta `hoy`, con todos los tipos */
export function semanal(filas: Fila[], hoy: string, n = 12): { lunes: string; t: Totales }[] {
  const semanas: { lunes: string; t: Totales }[] = [];
  let l = lunes(hoy);
  for (let i = 0; i < n; i++) {
    semanas.unshift({ lunes: l, t: totalesVacios() });
    l = sumarDias(l, -7);
  }
  const porLunes = new Map(semanas.map((s) => [s.lunes, s]));
  for (const f of filas) {
    const s = f.ambito === "total" ? porLunes.get(lunes(f.dia)) : undefined;
    if (s) s.t[f.tipo] += f.n;
  }
  return semanas;
}

/** Porcentaje de clics sobre apariciones (CTR), o null si hay muy pocas apariciones para que signifique algo */
export function ctr(t: Totales, minimo = 50): number | null {
  return t.impresion >= minimo ? Math.round((t.clic / t.impresion) * 1000) / 10 : null;
}

/** Destacados frente a normales: apariciones, clics, CTR y visitas medias por evento */
export function comparativaDestacados(filas: Fila[]) {
  return {
    destacado: totales(filas, "segmento", "destacado"),
    normal: totales(filas, "segmento", "normal"),
  };
}

/** Día de inicio de un periodo de `dias` días que acaba hoy (incluido) */
export const desdeHace = (hoy: string, dias: number) => sumarDias(hoy, -(dias - 1));

// --- Enlace secreto del informe de un organizador ---
// Sin guardar nada: el token es una firma del slug del organizador con una clave del servidor.
// Cambiar INFORMES_SECRETO (o ADMIN_CLAVE, si no está) invalida todos los enlaces enviados.

function clave(env: Record<string, string | undefined>) {
  const k = env.INFORMES_SECRETO || env.ADMIN_CLAVE;
  if (!k) throw new Error("Falta INFORMES_SECRETO (o ADMIN_CLAVE) para firmar los enlaces de los informes");
  return k;
}

export function tokenInforme(organizador: string, env: Record<string, string | undefined> = process.env): string {
  return createHmac("sha256", clave(env)).update(`informe:${organizador}`).digest("base64url").slice(0, 24);
}

export function tokenValido(organizador: string, token: string, env: Record<string, string | undefined> = process.env): boolean {
  if (!env.INFORMES_SECRETO && !env.ADMIN_CLAVE) return false;
  const a = Buffer.from(tokenInforme(organizador, env));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Frase lista para enviar al organizador */
export function fraseInforme(titulo: string, t: Totales): string {
  const partes = [`${t.vista} ${t.vista === 1 ? "visita" : "visitas"}`];
  if (t.impresion) partes.unshift(`apareció ${t.impresion} ${t.impresion === 1 ? "vez" : "veces"} en la agenda`);
  const gente = (n: number, uno: string, varios: string) => (n === 1 ? `1 persona ${uno}` : `${n} ${varios}`);
  const acciones = [
    t["como-llegar"] && gente(t["como-llegar"], "pidió cómo llegar", "pidieron cómo llegar"),
    t.calendario && gente(t.calendario, "lo añadió a su calendario", "lo añadieron a su calendario"),
    t.inscripcion && gente(t.inscripcion, "fue a inscribirse", "fueron a inscribirse"),
    t.compartir && gente(t.compartir, "lo compartió", "lo compartieron"),
  ].filter(Boolean) as string[];
  const cifras = partes.join(" y tuvo ");
  return `Tu evento «${titulo}» ${cifras}${acciones.length ? `; ${acciones.join(", ")}` : ""}.`;
}
