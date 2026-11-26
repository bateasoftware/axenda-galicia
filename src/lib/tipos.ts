// Modelo de datos de un evento. Es la única fuente de verdad: de aquí salen los tipos
// de TypeScript, la validación de data/eventos y el formato que devuelve el extractor.
import { z } from "zod";
import { finValido } from "./fechas";

// Mensajes de error de validación en castellano
z.config(z.locales.es());

export const LISTA_CATEGORIAS = [
  "navidad",
  "fiestas",
  "musica",
  "cine",
  "teatro",
  "infantil",
  "deporte",
  "solidario",
  "mercadillo",
  "gastronomia",
  "cultura",
  "comercial",
] as const;

const RE_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RE_FECHA_O_HORA = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Forma "plana" (solo tipos, sin formatos): es la que se manda al modelo como
// formato de salida, porque los formatos estructurados no admiten todas las reglas.
export const SesionBase = z.object({
  /** ISO local sin zona, p. ej. "2026-11-22T17:00" (hora de Galicia), o solo el día "2026-11-22" si no tiene hora */
  inicio: z.string().describe("YYYY-MM-DDTHH:MM, hora local de Galicia. Solo YYYY-MM-DD si el cartel no indica hora"),
  fin: z.string().optional().describe("YYYY-MM-DDTHH:MM, o solo YYYY-MM-DD si no hay hora (último día de un evento de varios días)"),
  /** Qué pasa en esa sesión, si el cartel trae programa por horas */
  nota: z.string().optional(),
});

export const LugarBase = z.object({
  nombre: z.string(),
  direccion: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  /** true si las coordenadas son aproximadas y conviene revisarlas */
  aprox: z.boolean().optional(),
});

export const InscripcionBase = z.object({
  url: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  /** Fecha límite YYYY-MM-DD */
  hasta: z.string().optional().describe("YYYY-MM-DD"),
});

export const LISTA_CANALES = ["whatsapp", "formulario", "email", "ics", "programa-pdf", "datos-abiertos", "manual"] as const;

/** De dónde viene el evento. Nunca lleva datos de quien lo envía (esos van aparte y no se publican). */
export const FuenteEventoBase = z.object({
  canal: z.enum(LISTA_CANALES),
  /** Cuándo llegó o se importó, YYYY-MM-DDTHH:MM hora de Galicia */
  recibido: z.string(),
  /** id de la fuente en data/fuentes.json (importadores) */
  id_fuente: z.string().optional(),
  /** Página original del evento */
  url: z.string().optional(),
  /** Identificador del evento en la fuente (UID del ICS, id del dataset…), para no importarlo dos veces */
  uid: z.string().optional(),
  /** Atribución que exige la licencia de la fuente (p. ej. CC BY / ODC-BY); se muestra en la ficha */
  atribucion: z.string().optional(),
});

export const EventoBase = z.object({
  slug: z.string().describe("kebab-case corto con lugar y año"),
  titulo: z.string().describe("Título claro en castellano"),
  /** Título en gallego si el cartel está en gallego o lo traducimos */
  titulo_gl: z.string().optional(),
  resumen: z.string().describe("1-2 frases propias, sin copiar literalmente el cartel"),
  sesiones: z.array(SesionBase),
  lugares: z.array(LugarBase),
  concello: z.string(),
  parroquia: z.string().optional(),
  organizadores: z.array(z.string()),
  categorias: z.array(z.enum(LISTA_CATEGORIAS)),
  publico: z.string().optional(),
  precio: z.string().optional(),
  inscripcion: InscripcionBase.optional(),
  extras: z.array(z.string()).optional(),
  /** Ruta pública del cartel: "/carteles/xxx.jpg" (repo), "/cartel/<id>.jpg" (guardado en Turso) o URL de Vercel Blob o Supabase Storage */
  cartel: z.string().optional(),
  idioma: z.enum(["gl", "es", "mixto"]),
  fuente: FuenteEventoBase,
  /** Campos deducidos, no leídos literalmente (para revisar) */
  inferido: z.array(z.string()).optional(),
  /** 0–1: seguridad de la extracción */
  confianza: z.number(),
  /** Evento que se repite cada año (XVI edición, "un año más"…) */
  recurrente: z.boolean().optional(),
  /** true si es promoción de un negocio */
  comercial: z.boolean().optional(),
  /** Destacado (de pago) hasta ese día incluido, YYYY-MM-DD. Lo pone una persona en el panel, nunca la IA */
  destacado_hasta: z.string().optional(),
  /** Exposición, muestra o feria larga: true/false lo fija una persona; si falta, se deduce de la duración (src/lib/larga-duracion.ts) */
  larga_duracion: z.boolean().optional(),
});

// Forma estricta: la que deben cumplir los eventos publicados.
const fechaHora = z.string().regex(RE_FECHA_HORA, "debe ser YYYY-MM-DDTHH:MM");
const fechaOHora = z.string().regex(RE_FECHA_O_HORA, "debe ser YYYY-MM-DD o YYYY-MM-DDTHH:MM");

export const SesionSchema = z
  .strictObject({ ...SesionBase.shape, inicio: fechaOHora, fin: fechaOHora.optional() })
  .refine((s) => !s.fin || finValido(s.inicio, s.fin), { message: "fin es anterior a inicio", path: ["fin"] });

export const LugarSchema = z.strictObject({
  ...LugarBase.shape,
  nombre: z.string().min(1),
  // Caja amplia alrededor de Galicia: atrapa lat/lng cruzadas o a 0
  lat: z.number().min(41.5).max(44),
  lng: z.number().min(-9.5).max(-6.5),
});

export const InscripcionSchema = z.strictObject({
  ...InscripcionBase.shape,
  url: z.url().optional(),
  email: z.email().optional(),
  hasta: z.string().regex(RE_FECHA, "debe ser YYYY-MM-DD").optional(),
});

export const EventoSchema = z.strictObject({
  ...EventoBase.shape,
  slug: z.string().regex(RE_SLUG, "solo minúsculas, números y guiones"),
  titulo: z.string().min(1),
  resumen: z.string().min(1),
  sesiones: z.array(SesionSchema).min(1, "hace falta al menos una sesión"),
  lugares: z.array(LugarSchema).min(1, "hace falta al menos un lugar"),
  concello: z.string().min(1),
  organizadores: z.array(z.string().min(1)),
  categorias: z.array(z.enum(LISTA_CATEGORIAS)).min(1, "hace falta al menos una categoría"),
  inscripcion: InscripcionSchema.optional(),
  cartel: z
    .string()
    .regex(
      /^(\/carteles\/[^/]+|\/cartel\/[0-9a-f-]{36}|https:\/\/[^/]+\/storage\/v1\/object\/public\/carteles\/[^/]+|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/carteles\/[^/]+)\.(jpe?g|png|webp)$/,
      "debe ser /carteles/<fichero>, /cartel/<id> o una URL de Vercel Blob o Supabase Storage",
    )
    .optional(),
  fuente: z.strictObject({ ...FuenteEventoBase.shape, recibido: fechaHora, url: z.url().optional() }),
  confianza: z.number().min(0).max(1),
  destacado_hasta: z.string().regex(RE_FECHA, "debe ser YYYY-MM-DD").optional(),
});

export type Sesion = z.infer<typeof SesionSchema>;
export type Lugar = z.infer<typeof LugarSchema>;
export type Inscripcion = z.infer<typeof InscripcionSchema>;
export type Categoria = (typeof LISTA_CATEGORIAS)[number];
export type Evento = z.infer<typeof EventoSchema>;
export type Canal = (typeof LISTA_CANALES)[number];
/** Evento tal como sale del extractor o de un importador: puede no cumplir todavía las reglas estrictas */
export type EventoBorrador = z.infer<typeof EventoBase>;

// Tabla de lugares conocidos (data/lugares.json), que usa el extractor
export const LugaresSchema = z.strictObject({
  _nota: z.string().optional(),
  concellos: z.record(
    z.string(),
    z.strictObject({ lat: LugarSchema.shape.lat, lng: LugarSchema.shape.lng, parroquias: z.array(z.string()) }),
  ),
  lugares: z.array(
    z.strictObject({ ...LugarSchema.shape, concello: z.string().min(1), parroquia: z.string().optional() }),
  ),
});
