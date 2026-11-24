// Detección de posibles duplicados: mismo día, mismo concello y título parecido.
// Se comparan los nuevos con los pendientes y los publicados. Nunca se borra nada solo:
// los dudosos se marcan para que la persona que revisa decida.
import fs from "node:fs";
import path from "node:path";
import type { Almacen } from "./almacen";
import type { Evento, EventoBorrador } from "./tipos";
import { normalizar } from "./importar/ubicar";

/** Por encima de esto se considera el mismo evento (los importadores no lo crean) */
export const UMBRAL_SEGURO = 0.85;
/** Por encima de esto se marca como posible duplicado */
export const UMBRAL_POSIBLE = 0.5;

// Palabras que no distinguen un evento de otro
const VACIAS = new Set(
  "a o os as e y de del da do das dos en no na nos nas el la los las un una unha con para por ao a la al ou o 2024 2025 2026 2027 2028 concello concerto concierto festa fiesta evento edicion xornada jornada".split(" "),
);

function palabras(titulo: string): Set<string> {
  return new Set(
    normalizar(titulo)
      .split(" ")
      .filter((p) => p.length > 1 && !VACIAS.has(p))
      // Plurales y variantes simples: "luces"/"luz", "nadal"/"nadales" → raíz de 5 letras
      .map((p) => p.slice(0, 5)),
  );
}

function bigramas(s: string): string[] {
  const t = normalizar(s).replace(/ /g, "");
  const r: string[] = [];
  for (let i = 0; i < t.length - 1; i++) r.push(t.slice(i, i + 2));
  return r;
}

/** Parecido de dos títulos, 0–1: lo mejor entre palabras comunes y bigramas de letras (Dice) */
export function parecidoTitulos(a: string, b: string): number {
  const pa = palabras(a);
  const pb = palabras(b);
  const comunes = [...pa].filter((p) => pb.has(p)).length;
  const porPalabras = pa.size && pb.size ? (2 * comunes) / (pa.size + pb.size) : 0;
  // Si un título contiene todas las palabras del otro ("Magosto" ⊂ "Magosto popular de Panxón")
  const contenido = pa.size && pb.size && comunes === Math.min(pa.size, pb.size) ? 0.8 : 0;
  const ba = bigramas(a);
  const bb = bigramas(b);
  const resto = [...bb];
  let comunesB = 0;
  for (const x of ba) {
    const i = resto.indexOf(x);
    if (i >= 0) {
      comunesB++;
      resto.splice(i, 1);
    }
  }
  const porLetras = ba.length + bb.length ? (2 * comunesB) / (ba.length + bb.length) : 0;
  return Math.max(porPalabras, porLetras, contenido);
}

/** Días (YYYY-MM-DD) en que hay sesión, contando los días intermedios de las que duran varios */
export function diasDe(e: Pick<EventoBorrador, "sesiones">): Set<string> {
  const dias = new Set<string>();
  for (const s of e.sesiones ?? []) {
    const ini = s.inicio?.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ini ?? "")) continue;
    const fin = s.fin && /^\d{4}-\d{2}-\d{2}/.test(s.fin) ? s.fin.slice(0, 10) : ini;
    const d = new Date(`${ini}T00:00:00Z`);
    // Tope de 60 días para no recorrer exposiciones de un año entero
    for (let n = 0; n < 60 && d.toISOString().slice(0, 10) <= fin; n++) {
      dias.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return dias;
}

export type Candidato = { ref: string; evento: Pick<EventoBorrador, "titulo" | "titulo_gl" | "concello" | "sesiones"> };
export type Coincidencia = { ref: string; parecido: number };

/** Coincidencias de un evento con una lista, de más a menos parecida */
export function coincidencias(e: Candidato["evento"], lista: Candidato[]): Coincidencia[] {
  const dias = diasDe(e);
  const titulos = [e.titulo, e.titulo_gl].filter(Boolean) as string[];
  const r: Coincidencia[] = [];
  for (const c of lista) {
    if (normalizar(c.evento.concello ?? "") !== normalizar(e.concello ?? "")) continue;
    const otros = diasDe(c.evento);
    if (![...dias].some((d) => otros.has(d))) continue;
    const otrosTitulos = [c.evento.titulo, c.evento.titulo_gl].filter(Boolean) as string[];
    const parecido = Math.max(...titulos.flatMap((t) => otrosTitulos.map((o) => parecidoTitulos(t, o))));
    if (parecido >= UMBRAL_POSIBLE) r.push({ ref: c.ref, parecido: Math.round(parecido * 100) / 100 });
  }
  return r.sort((a, b) => b.parecido - a.parecido);
}

/** Eventos publicados en data/eventos (también cuando el almacén es Supabase) */
function publicadosEnFicheros(): Evento[] {
  const dir = path.join(process.cwd(), "data", "eventos");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Evento);
  } catch {
    return [];
  }
}

/** Todo lo que puede estar repetido: pendientes y publicados */
export async function candidatosDe(almacen: Almacen): Promise<Candidato[]> {
  const publicados = new Map<string, Evento>();
  // Con Supabase, los publicados en data/eventos siguen contando (en local ya los da el almacén)
  if (almacen.tipo === "supabase") for (const e of publicadosEnFicheros()) publicados.set(e.slug, e);
  for (const e of await almacen.publicados()) publicados.set(e.slug, e);
  return [
    ...[...publicados.values()].map((e) => ({ ref: `evento:${e.slug}`, evento: e })),
    ...(await almacen.pendientes()).map((p) => ({ ref: `pendiente:${p.id}`, evento: p.evento })),
  ];
}

export type Detector = {
  /** Coincidencias de un evento nuevo con lo que ya hay */
  buscar(e: Candidato["evento"]): Coincidencia[];
  /** Añade a la lista lo que se acaba de crear (para comparar entre fuentes de la misma importación) */
  anotar(ref: string, e: Candidato["evento"]): void;
};

/** Carga una vez los pendientes y publicados y compara contra ellos */
export async function detectorDuplicados(almacen: Almacen): Promise<Detector> {
  const lista = await candidatosDe(almacen);
  return {
    buscar: (e) => coincidencias(e, lista),
    anotar: (ref, e) => void lista.push({ ref, evento: e }),
  };
}

/** Versión simple: los posibles duplicados de un evento ("evento:<slug>" o "pendiente:<id>") */
export async function buscadorDuplicados(almacen: Almacen): Promise<(e: EventoBorrador) => string[]> {
  const d = await detectorDuplicados(almacen);
  return (e) => d.buscar(e).map((c) => c.ref);
}

/** Los pendientes que se parecen a otro pendiente o a un publicado (para revisar los que ya había) */
export async function duplicadosEntrePendientes(almacen: Almacen): Promise<{ id: string; titulo: string; coincidencias: Coincidencia[] }[]> {
  const lista = await candidatosDe(almacen);
  return (await almacen.pendientes())
    .map((p) => ({
      id: p.id,
      titulo: p.evento.titulo,
      coincidencias: coincidencias(
        p.evento,
        lista.filter((c) => c.ref !== `pendiente:${p.id}`),
      ),
    }))
    .filter((x) => x.coincidencias.length);
}

/** ¿Es casi seguro que ya lo tenemos? (los importadores no crean otro) */
export function esDuplicadoSeguro(e: Candidato["evento"], lista: Candidato[]): string | null {
  const [mejor] = coincidencias(e, lista);
  return mejor && mejor.parecido >= UMBRAL_SEGURO ? mejor.ref : null;
}
