// Cuentas para /admin/cobertura: qué canal y qué fuente traen eventos, de qué concellos y cuántos por semana.
import type { RegistroCobertura } from "../almacen";

export const CANALES_DIRECTOS = new Set(["whatsapp", "formulario", "email"]);

type Cuenta = { clave: string; publicado: number; pendiente: number; descartado: number; total: number };

function contar(registros: RegistroCobertura[], clave: (r: RegistroCobertura) => string): Cuenta[] {
  const m = new Map<string, Cuenta>();
  for (const r of registros) {
    const k = clave(r);
    const c = m.get(k) ?? { clave: k, publicado: 0, pendiente: 0, descartado: 0, total: 0 };
    c[r.estado]++;
    c.total++;
    m.set(k, c);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

/** Lunes (YYYY-MM-DD) de la semana de una fecha */
export function lunes(fecha: string): string {
  const d = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export type Semana = { lunes: string; porCanal: Record<string, number>; total: number; publicados: number };

export function resumenCobertura(registros: RegistroCobertura[], hoy: string, semanas = 12) {
  const publicados = registros.filter((r) => r.estado === "publicado");
  const directos = publicados.filter((r) => CANALES_DIRECTOS.has(r.canal)).length;

  // Últimas N semanas por fecha de llegada
  const ultimas: Semana[] = [];
  const d = new Date(`${lunes(hoy)}T00:00:00Z`);
  for (let i = 0; i < semanas; i++) {
    ultimas.unshift({ lunes: d.toISOString().slice(0, 10), porCanal: {}, total: 0, publicados: 0 });
    d.setUTCDate(d.getUTCDate() - 7);
  }
  const porLunes = new Map(ultimas.map((s) => [s.lunes, s]));
  for (const r of registros) {
    const s = porLunes.get(lunes(r.recibido));
    if (!s) continue;
    s.porCanal[r.canal] = (s.porCanal[r.canal] ?? 0) + 1;
    s.total++;
    if (r.estado === "publicado") s.publicados++;
  }

  return {
    total: registros.length,
    publicados: publicados.length,
    pendientes: registros.filter((r) => r.estado === "pendiente").length,
    descartados: registros.filter((r) => r.estado === "descartado").length,
    /** Porcentaje de lo publicado que llegó por envío directo (objetivo de docs/vision.md) */
    directo: publicados.length ? Math.round((directos / publicados.length) * 100) : 0,
    porCanal: contar(registros, (r) => r.canal),
    porFuente: contar(
      registros.filter((r) => r.id_fuente),
      (r) => r.id_fuente!,
    ),
    porConcello: contar(registros, (r) => r.concello || "(sin concello)"),
    semanas: ultimas,
  };
}
