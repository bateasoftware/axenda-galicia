// Reglas de publicación rápida: qué pendientes se pueden publicar de un clic porque vienen de un emisor
// con historial limpio. Es opcional y está vacío por defecto (data/reglas.json). Nunca publica solo:
// el panel enseña la lista y una persona pulsa el botón.
import { z } from "zod";
import type { Pendiente, RegistroCobertura } from "../almacen";
import { MARCA_POR_COMPLETAR } from "../sin-ia";
import { prepararPublicacion } from "./lote";

export const ReglaSchema = z.object({
  /** id de una fuente (data/fuentes.json) o canal (whatsapp, formulario…) */
  emisor: z.string().min(1),
  /** Confianza mínima de la extracción, 0–1 */
  confianza_minima: z.number().min(0).max(1).default(0.9),
  /** Cuántos eventos de este emisor se han publicado ya */
  publicados_minimos: z.number().int().min(1).default(5),
  /** Máxima proporción de descartados sobre publicados + descartados */
  descartes_maximos: z.number().min(0).max(1).default(0.1),
  /** Publicar aunque traiga campos deducidos (`inferido`); por defecto no */
  permitir_deducidos: z.boolean().default(false),
});
export const ReglasSchema = z.object({ autopublicar: z.array(ReglaSchema).default([]) }).passthrough();
export type Regla = z.infer<typeof ReglaSchema>;

export const emisorDe = (p: Pick<Pendiente, "evento">) => p.evento.fuente.id_fuente ?? p.evento.fuente.canal;

export type Historial = Map<string, { publicados: number; descartados: number }>;

export function historialPorEmisor(registros: RegistroCobertura[]): Historial {
  const h: Historial = new Map();
  for (const r of registros) {
    if (r.estado === "pendiente") continue;
    const k = r.id_fuente ?? r.canal;
    const x = h.get(k) ?? { publicados: 0, descartados: 0 };
    if (r.estado === "publicado") x.publicados++;
    else x.descartados++;
    h.set(k, x);
  }
  return h;
}

/** ¿Cumple el pendiente alguna regla? Devuelve el motivo si no (para enseñarlo en el panel). */
export function cumpleRegla(p: Pendiente, reglas: Regla[], historial: Historial): { ok: true; regla: Regla } | { ok: false; motivo: string } {
  const emisor = emisorDe(p);
  const regla = reglas.find((r) => r.emisor === emisor);
  if (!regla) return { ok: false, motivo: "sin regla para este emisor" };
  const h = historial.get(emisor) ?? { publicados: 0, descartados: 0 };
  if (h.publicados < regla.publicados_minimos) return { ok: false, motivo: `aún tiene pocos publicados (${h.publicados} de ${regla.publicados_minimos})` };
  const total = h.publicados + h.descartados;
  if (h.descartados / total > regla.descartes_maximos) return { ok: false, motivo: `demasiados descartados (${h.descartados} de ${total})` };
  if (p.evento.inferido?.includes(MARCA_POR_COMPLETAR)) return { ok: false, motivo: "está por completar a mano" };
  if (p.evento.confianza < regla.confianza_minima) return { ok: false, motivo: `confianza ${Math.round(p.evento.confianza * 100)} % (mínimo ${Math.round(regla.confianza_minima * 100)} %)` };
  if (!regla.permitir_deducidos && p.evento.inferido?.length) return { ok: false, motivo: "trae campos deducidos" };
  return { ok: true, regla };
}

/** Los pendientes que se pueden publicar de un clic: cumplen una regla y pasan las mismas comprobaciones que el lote */
export function pendientesDeConfianza(
  pendientes: Pendiente[],
  reglas: Regla[],
  historial: Historial,
  slugOcupado: (slug: string) => boolean,
  slugLibre: (slug: string, ocupado: (s: string) => boolean) => string,
): Pendiente[] {
  if (!reglas.length) return [];
  return pendientes.filter((p) => cumpleRegla(p, reglas, historial).ok && prepararPublicacion(p, slugOcupado, slugLibre).ok);
}
