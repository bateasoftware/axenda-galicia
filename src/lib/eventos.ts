import "server-only";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import type { Evento } from "./tipos";
import { primerInicio } from "./fechas";
import { formatearProblemas, leerEventos } from "./validacion";
import { slugConcello } from "./slug";
import { almacenSupabase, supabaseConfigurado } from "./almacen";

export { slugConcello };

// Los eventos publicados salen de dos sitios:
//  - data/eventos/*.json (git como CMS; lo publicado con npm run publicar o el panel en local)
//  - Supabase, si están SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (lo publicado desde /admin en Vercel)
// Si un slug está en los dos, gana Supabase. Las vistas solo usan estas funciones.

/** Etiqueta de caché: al publicar desde el panel se invalida y las páginas se regeneran */
export const ETIQUETA_EVENTOS = "eventos";

const RAIZ = process.cwd();
const DIR = path.join(RAIZ, "data", "eventos");

function eventosEnFicheros(): Evento[] {
  const { eventos, problemas } = leerEventos(DIR, RAIZ);
  // Un evento mal formado hace fallar el build con un mensaje claro, en vez de romper una vista
  if (problemas.length) {
    throw new Error(`Hay eventos no válidos en data/eventos (ejecuta npm run validar):\n${formatearProblemas(problemas)}`);
  }
  return eventos;
}

async function eventosEnSupabase(): Promise<Evento[]> {
  if (!supabaseConfigurado()) return [];
  try {
    return await almacenSupabase({ url: process.env.SUPABASE_URL!, clave: process.env.SUPABASE_SERVICE_ROLE_KEY! }).publicados();
  } catch (err) {
    // Si Supabase falla, la web sigue con los JSON
    console.error("[eventos] no se pudo leer Supabase:", (err as Error).message);
    return [];
  }
}

export async function todosLosEventos(): Promise<Evento[]> {
  "use cache";
  cacheTag(ETIQUETA_EVENTOS);
  // En desarrollo se relee enseguida para ver al momento los JSON editados
  if (process.env.NODE_ENV === "development") cacheLife("seconds");
  else cacheLife("hours");
  const porSlug = new Map<string, Evento>();
  for (const e of eventosEnFicheros()) porSlug.set(e.slug, e);
  for (const e of await eventosEnSupabase()) porSlug.set(e.slug, e);
  return [...porSlug.values()].sort((a, b) => primerInicio(a).localeCompare(primerInicio(b)));
}

export async function eventoPorSlug(slug: string): Promise<Evento | undefined> {
  return (await todosLosEventos()).find((e) => e.slug === slug);
}

export async function concellos(): Promise<{ nombre: string; slug: string; total: number }[]> {
  const m = new Map<string, number>();
  for (const e of await todosLosEventos()) m.set(e.concello, (m.get(e.concello) ?? 0) + 1);
  return [...m.entries()]
    .map(([nombre, total]) => ({ nombre, slug: slugConcello(nombre), total }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Organizadores con sus eventos (para /organizador/[slug]) */
export async function organizadores(): Promise<{ nombre: string; slug: string; total: number }[]> {
  const m = new Map<string, { nombre: string; total: number }>();
  for (const e of await todosLosEventos())
    for (const o of e.organizadores) {
      const s = slugConcello(o);
      if (!s.replace(/-/g, "")) continue;
      const x = m.get(s) ?? { nombre: o, total: 0 };
      x.total++;
      m.set(s, x);
    }
  return [...m.entries()].map(([slug, x]) => ({ slug, ...x })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}
