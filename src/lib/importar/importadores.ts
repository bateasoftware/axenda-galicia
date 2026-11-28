// Importadores automáticos: convierten una fuente de data/fuentes.json en eventos pendientes.
// Nada se publica solo: todo entra como pendiente con "inferido" para revisar.
import { fechaHoraGalicia } from "../fechas";
import type { Fuente } from "../fuentes";
import type { Categoria, EventoBorrador } from "../tipos";
import { leerICS, type EventoICS } from "./ics";
import { normalizar, ubicar } from "./ubicar";

export const USER_AGENT = "AltofalanteBot/0.1 (+https://axenda-galicia.vercel.app/enviar)";

/** Candidato a pendiente: el evento y la clave para no importarlo dos veces */
export type Candidato = { evento: EventoBorrador; uid: string };

const REGLAS: [RegExp, Categoria][] = [
  [/\b(nadal|navidad|reis|reyes|belen|papa noel|cabalgata|cabalgata)\b/, "navidad"],
  [/\b(cine|cinema|pelicula|proxeccion|proyeccion|filmoteca|documental|curtametraxe|cortometraje)\b/, "cine"],
  [/\b(teatro|monologo|danza|circo|espectaculo)\b/, "teatro"],
  [/\b(concerto|concierto|musica|coro|banda|orquestra|orquesta|recital|jazz|rock|festival)\b/, "musica"],
  [/\b(infantil|nenos|ninos|cativos|familia|familiar|contacontos|cuentacuentos|obradoiro infantil)\b/, "infantil"],
  [/\b(carreira|carrera|andaina|torneo|partido|deporte|deportivo|ruta|sendeirismo|senderismo|bicicleta|xogos)\b/, "deporte"],
  [/\b(solidari[ao]|benefic[ao]|recadacion|recaudacion)\b/, "solidario"],
  [/\b(mercado|mercadillo|feira|feria|rastro)\b/, "mercadillo"],
  [/\b(gastronom|degustacion|cata|magosto|polbo|pulpo|viño|vino|comida|xantar)\b/, "gastronomia"],
  [/\b(festa|fiesta|verbena|romaria|romeria|entroido|carnaval)\b/, "fiestas"],
];

export function categoriasDe(...textos: (string | undefined)[]): Categoria[] {
  const t = normalizar(textos.filter(Boolean).join(" "));
  const cats = REGLAS.filter(([re]) => re.test(t)).map(([, c]) => c);
  return cats.length ? [...new Set(cats)].slice(0, 3) : ["cultura"];
}

/** Gallego si tiene varias palabras típicas */
export function idiomaDe(texto: string): "gl" | "es" {
  const t = ` ${normalizar(texto)} `;
  const gl = [" da ", " do ", " das ", " dos ", " unha ", " cos ", " coa ", " nenos ", " xornada", " obradoiro", " presentacion do ", " sobre a ", " e o "];
  return gl.filter((p) => t.includes(p)).length >= 1 ? "gl" : "es";
}

/** Resumen propio y neutro: nunca se copia la descripción de la fuente */
function resumenPropio(cats: Categoria[], lugar: string, concello: string): string {
  const tipo: Record<Categoria, string> = {
    navidad: "Actividad de Navidad",
    fiestas: "Fiesta",
    musica: "Concierto o actividad musical",
    cine: "Proyección de cine",
    teatro: "Espectáculo de artes escénicas",
    infantil: "Actividad para niños y familias",
    deporte: "Actividad deportiva",
    solidario: "Actividad solidaria",
    mercadillo: "Mercado o feria",
    gastronomia: "Actividad gastronómica",
    cultura: "Actividad cultural",
    comercial: "Promoción de comercio local",
  };
  return `${tipo[cats[0]]} en ${lugar} (${concello}).`;
}

function slugDe(titulo: string, inicio: string): string {
  return `${normalizar(titulo).split(" ").slice(0, 6).join("-")}-${inicio.slice(0, 4)}`;
}

/** Evento ICS → borrador, si es de uno de nuestros concellos */
export function desdeICS(e: EventoICS, fuente: Fuente, recibido = fechaHoraGalicia()): Candidato | null {
  const u = ubicar(e.lugar);
  if (!u) return null;
  const cats = categoriasDe(e.titulo, e.categorias.join(" "), e.descripcion?.slice(0, 300));
  const idioma = idiomaDe(`${e.titulo} ${e.descripcion ?? ""}`);
  const inferido = ["resumen", "categorías"];
  if (idioma === "gl") inferido.push("título en castellano (está en gallego)");
  if (u.lugar.aprox) inferido.push("coordenadas");
  if (e.recurrente) inferido.push("solo la primera fecha de una serie");
  return {
    uid: e.uid,
    evento: {
      slug: slugDe(e.titulo, e.inicio),
      titulo: e.titulo,
      ...(idioma === "gl" ? { titulo_gl: e.titulo } : {}),
      resumen: resumenPropio(cats, u.lugar.nombre, u.concello),
      sesiones: [{ inicio: e.inicio, ...(e.fin ? { fin: e.fin } : {}) }],
      lugares: [u.lugar],
      concello: u.concello,
      ...(u.parroquia ? { parroquia: u.parroquia } : {}),
      organizadores: [],
      categorias: cats,
      idioma,
      fuente: {
        canal: "ics",
        recibido,
        id_fuente: fuente.id,
        uid: e.uid,
        ...(e.url ? { url: e.url } : {}),
        ...(fuente.atribucion ? { atribucion: fuente.atribucion } : {}),
      },
      inferido,
      confianza: 0.7,
    },
  };
}

/** Registro de la agenda de datos.vigo.org (agenda-hoy.json) */
export type FilaVigo = {
  id: number;
  titulo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  permanente: boolean;
  direccion: string | null;
  subcategoria: string | null;
};

export function desdeVigo(f: FilaVigo, fuente: Fuente, recibido = fechaHoraGalicia()): Candidato | null {
  // Los permanentes (museos, rutas) no son eventos
  if (f.permanente || !f.fecha_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_inicio)) return null;
  const u = ubicar(`${f.direccion ?? ""} - Vigo`) ?? ubicar("Vigo")!;
  const lugar = f.direccion ? { ...u.lugar, nombre: f.direccion.split(/[.,]/)[0].trim().slice(0, 80) || "Vigo" } : u.lugar;
  const cats = categoriasDe(f.titulo);
  const fin = f.fecha_fin && f.fecha_fin > f.fecha_inicio ? f.fecha_fin : undefined;
  const largo = /program|ciclo|xornadas|jornadas|exposici/i.test(f.titulo);
  return {
    uid: String(f.id),
    evento: {
      slug: slugDe(f.titulo, f.fecha_inicio),
      titulo: f.titulo,
      resumen: resumenPropio(cats, lugar.nombre, "Vigo"),
      sesiones: [{ inicio: f.fecha_inicio, ...(fin ? { fin } : {}) }],
      lugares: [lugar],
      concello: "Vigo",
      organizadores: ["Concello de Vigo"],
      categorias: cats,
      idioma: idiomaDe(f.titulo),
      fuente: {
        canal: "datos-abiertos",
        recibido,
        id_fuente: fuente.id,
        uid: String(f.id),
        url: fuente.url,
        ...(fuente.atribucion ? { atribucion: fuente.atribucion } : {}),
      },
      inferido: ["resumen", "categorías", "coordenadas", ...(largo ? ["es un programa o exposición: ¿publicar o separar actos?"] : [])],
      confianza: 0.6,
    },
  };
}

export async function descargar(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res;
}

/** Importadores que no necesitan IA: devuelven los candidatos de una fuente */
export const IMPORTADORES: Partial<Record<NonNullable<Fuente["importador"]>, (f: Fuente) => Promise<Candidato[]>>> = {
  async ics(f) {
    const texto = await (await descargar(f.url_datos!)).text();
    return leerICS(texto)
      .map((e) => desdeICS(e, f))
      .filter((c): c is Candidato => c !== null);
  },
  async "vigo-agenda"(f) {
    const filas = (await (await descargar(f.url_datos!)).json()) as FilaVigo[];
    return filas.map((x) => desdeVigo(x, f)).filter((c): c is Candidato => c !== null);
  },
};
