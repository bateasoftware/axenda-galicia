// Publicar varios pendientes a la vez: qué se publica y qué se deja para revisar uno a uno.
import type { Pendiente } from "../almacen";
import type { Evento } from "../tipos";
import { validarEvento } from "../validacion";

export type Omitido = { titulo: string; motivo: string };

/** Lo que se enseña tras publicar por lotes (cookie de corta duración en /admin) */
export type ResultadoLote = {
  publicados: number;
  omitidos: Omitido[];
  /** Avisos por WhatsApp que no se pudieron enviar: hay que avisar a mano (el número no se guarda) */
  avisar: { titulo: string; numero: string; url: string }[];
};
export const COOKIE_LOTE = "axenda_lote";

/**
 * Un pendiente se publica en lote solo si no necesita una decisión de una persona:
 *  - sin posibles duplicados (hay que mirar con qué choca);
 *  - sin email de aviso (el mensaje para el organizador se prepara desde su ficha);
 *  - y que pase la validación estricta (fechas, lugar, categorías…).
 * Lo que se había deducido (`inferido`) se da por revisado, porque se ha elegido publicar.
 */
export function prepararPublicacion(
  p: Pendiente,
  slugOcupado: (slug: string) => boolean,
  slugLibre: (slug: string, ocupado: (s: string) => boolean) => string,
): { ok: true; evento: Evento } | { ok: false; motivo: string } {
  if (p.duplicados.length) return { ok: false, motivo: "posible duplicado: míralo antes de publicarlo" };
  if (p.contacto?.canal === "email") return { ok: false, motivo: "tiene un email de aviso: publícalo desde su ficha para enviarle el mensaje" };
  const slug = slugLibre(p.evento.slug, slugOcupado);
  const v = validarEvento({ ...p.evento, slug }, null);
  if (!v.ok) return { ok: false, motivo: `no se puede publicar: ${v.errores[0]}${v.errores.length > 1 ? ` (y ${v.errores.length - 1} más)` : ""}` };
  const { inferido: _inferido, ...limpio } = v.valor;
  void _inferido;
  return { ok: true, evento: limpio };
}
