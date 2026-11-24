// Registro de fuentes de eventos (data/fuentes.json): de dónde salen los eventos,
// cómo se recogen y cada cuánto hay que revisarlas. Sin "server-only": lo usan los scripts.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const METODOS = ["ics", "api", "pdf", "revision-manual", "envio-directo"] as const;
export const FRECUENCIAS = { diaria: 1, semanal: 7, quincenal: 14, mensual: 30 } as const;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const FuenteSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nombre: z.string().min(1),
  tipo: z.enum(["oficial", "institucion", "equipamiento", "asociativa", "organizador", "prensa", "agregador", "redes"]),
  /** Concello que cubre; "Val Miñor" o "Galicia" si es más amplia */
  concello: z.string().min(1),
  /** Página para personas (la que se revisa a mano) */
  url: z.url(),
  metodo: z.enum(METODOS),
  /** URL de datos para los importadores automáticos (ICS, JSON, PDF…). Puede llevar {MES} y {AÑO} */
  url_datos: z.string().optional(),
  /** Importador que la procesa en `npm run importar` (ver scripts/importar.ts) */
  importador: z.enum(["ics", "vigo-agenda", "pdf-mensual"]).optional(),
  /** Solo se importa si está activa */
  activa: z.boolean(),
  frecuencia: z.enum(Object.keys(FRECUENCIAS) as [keyof typeof FRECUENCIAS]),
  ultima_revision: z.string().regex(RE_FECHA).nullable(),
  estado: z.enum(["verificada", "sin verificar"]),
  licencia: z.string().optional(),
  /** Texto de atribución obligatorio que se guarda en cada evento importado */
  atribucion: z.string().optional(),
  notas: z.string().optional(),
});

export const RegistroFuentesSchema = z.strictObject({
  _nota: z.string().optional(),
  fuentes: z.array(FuenteSchema),
});

export type Fuente = z.infer<typeof FuenteSchema>;

export const RUTA_FUENTES = path.join(process.cwd(), "data", "fuentes.json");

export function leerFuentes(ruta = RUTA_FUENTES): Fuente[] {
  const r = RegistroFuentesSchema.parse(JSON.parse(fs.readFileSync(ruta, "utf8")));
  const ids = new Set<string>();
  for (const f of r.fuentes) {
    if (ids.has(f.id)) throw new Error(`fuentes.json: id repetido ${f.id}`);
    ids.add(f.id);
  }
  return r.fuentes;
}

export function guardarFuentes(fuentes: Fuente[], ruta = RUTA_FUENTES) {
  const actual = JSON.parse(fs.readFileSync(ruta, "utf8"));
  fs.writeFileSync(ruta, JSON.stringify({ ...actual, fuentes }, null, 2) + "\n");
}

/** Días entre dos fechas YYYY-MM-DD */
function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/** Fecha en la que toca volver a revisar la fuente (null si nunca se revisó: toca ya) */
export function proximaRevision(f: Fuente): string | null {
  if (!f.ultima_revision) return null;
  const d = new Date(`${f.ultima_revision}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + FRECUENCIAS[f.frecuencia]);
  return d.toISOString().slice(0, 10);
}

/** Fuentes de revisión manual o de envío directo que toca mirar hoy, las más atrasadas primero */
export function fuentesPorRevisar(fuentes: Fuente[], hoy: string): (Fuente & { retraso: number | null })[] {
  return fuentes
    .filter((f) => f.metodo !== "envio-directo")
    .map((f) => {
      const prox = proximaRevision(f);
      return { ...f, retraso: prox === null ? null : dias(prox, hoy) };
    })
    .filter((f) => f.retraso === null || f.retraso >= 0)
    .sort((a, b) => (b.retraso ?? Infinity) - (a.retraso ?? Infinity));
}

/** Sustituye {AÑO} y {MES} (en gallego y mayúsculas, como los boletines del SERGAS) en una URL */
export function urlDelMes(plantilla: string, anio: number, mes: number): string {
  const MESES = ["XANEIRO", "FEBREIRO", "MARZO", "ABRIL", "MAIO", "XUNO", "XULLO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DECEMBRO"];
  return plantilla.replaceAll("{AÑO}", String(anio)).replaceAll("{MES}", MESES[mes - 1]).replaceAll("{MM}", String(mes).padStart(2, "0"));
}
