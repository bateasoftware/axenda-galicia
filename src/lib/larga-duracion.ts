// Exposiciones, muestras y ferias largas: están abiertas semanas o meses y, si salieran en la agenda como un
// evento más, taparían lo que pasa cada día. En los listados aparecen solo el día que abren («Inaugura») y en
// sus últimos días; el resto del tiempo van en el bloque «En curso» y en /exposiciones.
import { dia, primerInicio, ultimoFin } from "./fechas";
import type { Evento } from "./tipos";

/** Una sesión que dura esto o más (días entre el primero y el último) es de larga duración */
export const DIAS_LARGA = 7;
/** Cuántos días antes del cierre se vuelve a mostrar en la agenda («Últimos días») */
export const DIAS_ULTIMOS = 7;

/** Días entre dos fechas YYYY-MM-DD (b − a) */
export function diasEntre(a: string, b: string): number {
  const t = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Lo decide `larga_duracion` si una persona lo ha fijado; si no, que alguna sesión dure una semana o más */
export function esLargaDuracion(e: Pick<Evento, "sesiones" | "larga_duracion">): boolean {
  if (typeof e.larga_duracion === "boolean") return e.larga_duracion;
  return e.sesiones.some((s) => s.fin && diasEntre(dia(s.inicio), dia(s.fin)) >= DIAS_LARGA);
}

export type Momento = "inaugura" | "ultimos-dias" | "ultimo-dia";
export const NOMBRE_MOMENTO: Record<Momento, string> = { inaugura: "Inaugura", "ultimos-dias": "Últimos días", "ultimo-dia": "Último día" };

/**
 * Dónde va un evento largo en una agenda por días que cubre [desde, hasta] (hasta = null: sin límite):
 *  - el día que abre, si cae dentro;
 *  - si no, el día que cierra, si cae dentro y está a DIAS_ULTIMOS días o menos de `hoy`;
 *  - si no, en ningún día (va al bloque «En curso», si está abierto en ese rango).
 */
export function colocarLarga(e: Evento, hoy: string, desde: string, hasta: string | null): { dia: string; momento: Momento } | null {
  const ini = dia(primerInicio(e));
  const fin = dia(ultimoFin(e));
  const dentro = (d: string) => d >= desde && (hasta === null || d <= hasta);
  if (ini >= hoy && dentro(ini)) return { dia: ini, momento: "inaugura" };
  if (fin >= hoy && dentro(fin) && diasEntre(hoy, fin) <= DIAS_ULTIMOS) return { dia: fin, momento: fin === hoy ? "ultimo-dia" : "ultimos-dias" };
  return null;
}

/** ¿Está abierto en algún momento de [desde, hasta]? */
export const abiertoEntre = (e: Evento, desde: string, hasta: string) => dia(primerInicio(e)) <= hasta && dia(ultimoFin(e)) >= desde;

/** Abiertos hoy (los que cierran antes, primero) y los que abren más adelante (por fecha de apertura) */
export function repartirLargas(eventos: Evento[], hoy: string): { abiertas: Evento[]; proximas: Evento[] } {
  const largas = eventos.filter(esLargaDuracion).filter((e) => dia(ultimoFin(e)) >= hoy);
  return {
    abiertas: largas.filter((e) => dia(primerInicio(e)) <= hoy).sort((a, b) => ultimoFin(a).localeCompare(ultimoFin(b))),
    proximas: largas.filter((e) => dia(primerInicio(e)) > hoy).sort((a, b) => primerInicio(a).localeCompare(primerInicio(b))),
  };
}
