// Ayudas para validar a mano los pendientes que llegan sin cartel (Cultura de Galicia, datos abiertos de Vigo…):
// el enlace a la página original y una búsqueda ya rellenada con título, fecha y lugar.
import type { EventoBorrador } from "../tipos";

/** Web oficial de cada concello, para buscar solo en ella */
export const WEB_CONCELLO: Record<string, string> = {
  Vigo: "vigo.org",
  Nigrán: "nigran.es",
  Baiona: "baiona.gal",
  Gondomar: "concellodegondomar.gal",
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Página del propio evento en la fuente. Los de datos.vigo.org no la guardaban: se reconstruye con su id. */
export function enlaceOrigen(e: Pick<EventoBorrador, "fuente">): string | undefined {
  const f = e.fuente;
  if (f.id_fuente === "vigo-agenda-cultural" && f.uid && /^\d+$/.test(f.uid)) return urlEventoVigo(f.uid);
  if (!f.url || !/^https?:\/\//.test(f.url)) return undefined;
  // La portada de un portal no es el evento
  if (new URL(f.url).pathname.replace(/\/+$/, "") === "") return undefined;
  return f.url;
}

export const urlEventoVigo = (id: string | number) => `https://hoxe.vigo.org/axenda/?id=${id}&lang=cas`;

/** "28 noviembre 2026": como lo escribiría una persona en el buscador */
function fechaBusqueda(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y && m && d ? `${d} ${MESES[m - 1]} ${y}` : "";
}

/** Texto de búsqueda: título, fecha y lugar (sin repetir el concello si ya va en el nombre del lugar) */
export function textoBusqueda(e: Pick<EventoBorrador, "titulo" | "sesiones" | "lugares" | "concello">): string {
  const lugar = e.lugares[0]?.nombre?.trim();
  const partes = [e.titulo?.trim(), e.sesiones[0]?.inicio ? fechaBusqueda(e.sesiones[0].inicio) : "", lugar];
  if (e.concello && !(lugar ?? "").toLowerCase().includes(e.concello.toLowerCase())) partes.push(e.concello);
  return partes.filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 200);
}

/** Búsqueda en Google; con `sitio`, solo en esa web */
export function enlaceBusqueda(texto: string, sitio?: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(sitio ? `${texto} site:${sitio}` : texto)}`;
}

export function busquedasDe(e: Pick<EventoBorrador, "titulo" | "sesiones" | "lugares" | "concello">): { general: string; oficial?: { sitio: string; url: string } } {
  const texto = textoBusqueda(e);
  const sitio = WEB_CONCELLO[e.concello];
  return { general: enlaceBusqueda(texto), ...(sitio ? { oficial: { sitio, url: enlaceBusqueda(texto, sitio) } } : {}) };
}

/** Sin hora: todas las sesiones son de día completo (la fuente no la da o no se leyó) */
export const sinHora = (e: Pick<EventoBorrador, "sesiones">) => e.sesiones.length > 0 && e.sesiones.every((s) => !/T\d/.test(s.inicio));
