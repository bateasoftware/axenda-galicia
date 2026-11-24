// Entrada sin la API de Claude (sin ANTHROPIC_API_KEY): lo recibido se guarda como un pendiente
// "por completar", con el cartel y el texto que lo acompañaba. Se rellena a mano en /admin mirando
// el cartel, o se pide a Claude Code que lo extraiga (ver AGENTS.md, "Extraer sin API").
import type { EntradaExtraccion, EventoExtraido, ResultadoExtraccion } from "./extraccion";
import { limpiarSlug } from "./almacen/local";

export const MARCA_POR_COMPLETAR = "por completar: rellena los datos mirando el cartel";

/** Saca "Qué: …" o "Organiza: …" del texto del formulario */
const campo = (nota: string, nombre: string) => nota.match(new RegExp(`^${nombre}:\\s*(.+)$`, "mi"))?.[1]?.trim();

export async function extraerSinIA({ archivo, recibido, nota }: EntradaExtraccion): Promise<ResultadoExtraccion> {
  const texto = nota?.trim() ?? "";
  const titulo = campo(texto, "Qué") ?? "";
  const organiza = campo(texto, "Organiza");
  const inferido = [MARCA_POR_COMPLETAR];
  if (archivo?.tipo === "application/pdf")
    inferido.push("llegó un PDF (programa): sin la API no se guarda; pide el programa por email o extráelo con Claude Code");
  // El texto recibido va en "inferido", que nunca se publica (se quita al publicar)
  if (texto) inferido.push(...texto.slice(0, 1000).split("\n").filter(Boolean).map((l) => `texto recibido → ${l}`));
  const evento: EventoExtraido = {
    slug: limpiarSlug(titulo, `por-completar-${recibido.slice(0, 10)}`),
    titulo,
    resumen: "",
    sesiones: [],
    lugares: [],
    concello: "",
    organizadores: organiza ? [organiza] : [],
    categorias: [],
    idioma: "es",
    inferido,
    confianza: 0,
  };
  return { tipo: "ok", eventos: [evento] };
}
