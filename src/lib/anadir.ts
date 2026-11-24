// Completa un evento "mínimo" (el que escribe quien lo extrae a mano o Claude Code desde un cartel o un enlace)
// hasta un borrador válido: slug, coordenadas, origen (`fuente`)… Lo usa `npm run anadir-pendiente`.
import { z } from "zod";
import { filasALugares } from "./admin/formulario";
import { limpiarSlug } from "./almacen/local";
import { InscripcionBase, LISTA_CANALES, LISTA_CATEGORIAS, SesionBase, type Canal, type EventoBorrador } from "./tipos";
import { validarEvento } from "./validacion";

/** Lo mínimo que hay que escribir de un evento. Lo que falte se completa solo. */
export const EventoMinimo = z.strictObject({
  slug: z.string().optional().describe("Se calcula del título y el año si falta"),
  titulo: z.string().min(1),
  titulo_gl: z.string().optional(),
  resumen: z.string().min(1).describe("1-2 frases propias, nunca copiadas"),
  sesiones: z.array(SesionBase).min(1).describe('inicio "YYYY-MM-DDTHH:MM", o solo "YYYY-MM-DD" si no hay hora'),
  /** Basta con el nombre: las coordenadas se calculan (sitio conocido o centro del concello, aproximadas) */
  lugares: z
    .array(z.strictObject({ nombre: z.string().min(1), direccion: z.string().optional(), lat: z.number().optional(), lng: z.number().optional(), aprox: z.boolean().optional() }))
    .min(1),
  concello: z.string().min(1),
  parroquia: z.string().optional(),
  organizadores: z.array(z.string()).default([]),
  categorias: z.array(z.enum(LISTA_CATEGORIAS)).min(1),
  publico: z.string().optional(),
  precio: z.string().optional(),
  inscripcion: InscripcionBase.optional(),
  extras: z.array(z.string()).optional(),
  idioma: z.enum(["gl", "es", "mixto"]).default("es"),
  inferido: z.array(z.string()).optional(),
  confianza: z.number().min(0).max(1).default(0.8),
  recurrente: z.boolean().optional(),
  comercial: z.boolean().optional(),
});

export type Contexto = {
  canal: Canal;
  /** YYYY-MM-DDTHH:MM, hora de Galicia */
  recibido: string;
  /** Enlace de donde sale el evento, si lo hay */
  url?: string;
};

export const CANALES_VALIDOS = LISTA_CANALES;

/** Un evento mínimo → borrador completo. Devuelve los errores (campo por campo) si no se puede. */
export function construirBorrador(entrada: unknown, ctx: Contexto): { evento?: EventoBorrador; errores: string[]; avisos: string[] } {
  const r = EventoMinimo.safeParse(entrada);
  if (!r.success) return { errores: r.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(raíz)"}: ${i.message}`), avisos: [] };
  const m = r.data;

  const lugares = filasALugares(
    m.lugares.map((l) => ({
      nombre: l.nombre,
      direccion: l.direccion ?? "",
      lat: l.lat === undefined ? "" : String(l.lat),
      lng: l.lng === undefined ? "" : String(l.lng),
      aprox: l.aprox ?? false,
    })),
    m.concello,
  );
  if (lugares.errores.length) return { errores: lugares.errores, avisos: [] };

  const anio = m.sesiones[0].inicio.slice(0, 4);
  const base = limpiarSlug(m.titulo, "evento").slice(0, 60).replace(/-+$/, "");
  const inferido = [...(m.inferido ?? [])];
  if (lugares.lugares.some((l) => l.aprox) && !inferido.some((x) => /coordenadas/i.test(x))) inferido.push("coordenadas (aproximadas)");

  const { slug, inscripcion, extras, inferido: _i, ...resto } = m;
  void _i;
  const evento: EventoBorrador = {
    ...resto,
    slug: slug ?? (base.endsWith(anio) ? base : `${base}-${anio}`),
    lugares: lugares.lugares,
    ...(inscripcion ? { inscripcion } : {}),
    ...(extras?.length ? { extras } : {}),
    ...(inferido.length ? { inferido } : {}),
    fuente: { canal: ctx.canal, recibido: ctx.recibido, ...(ctx.url ? { url: ctx.url } : {}) },
  };
  // Lo que falte para publicar se avisa ya; en el panel se puede corregir
  const v = validarEvento(evento, null);
  return v.ok ? { evento, errores: [], avisos: v.avisos } : { evento, errores: v.errores, avisos: v.avisos };
}
