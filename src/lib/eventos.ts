import "server-only";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import type { Evento } from "./tipos";
import { primerInicio } from "./fechas";
import { formatearProblemas, leerEventos } from "./validacion";
import { slugConcello } from "./slug";
import { almacenRemoto } from "./almacen";

export { slugConcello };

// Los eventos publicados salen de dos sitios:
//  - data/eventos/*.json (git como CMS; lo publicado con npm run publicar o el panel en local)
//  - el almacén en la nube (Turso o Supabase), lo publicado desde /admin en Vercel
// Si un slug está en los dos, gana la nube. Las vistas solo usan estas funciones.

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

async function eventosEnLaNube(): Promise<Evento[]> {
  const remoto = almacenRemoto();
  if (!remoto) return [];
  try {
    return await remoto.publicados();
  } catch (err) {
    // Si la base de datos falla, la web sigue con los JSON
    console.error(`[eventos] no se pudo leer ${remoto.tipo}:`, (err as Error).message);
    return [];
  }
}

export async function todosLosEventos(): Promise<Evento[]> {
  "use cache";
  cacheTag(ETIQUETA_EVENTOS);
  // En desarrollo se revalida al segundo para ver enseguida los JSON editados (con la recarga siguiente).
  // stale ≥ 30 s y expire ≥ 5 min: así no cuenta como caché "corta" y las páginas siguen siendo estáticas.
  if (process.env.NODE_ENV === "development") cacheLife({ stale: 30, revalidate: 1, expire: 300 });
  else cacheLife("hours");
  const porSlug = new Map<string, Evento>();
  for (const e of eventosEnFicheros()) porSlug.set(e.slug, e);
  for (const e of await eventosEnLaNube()) porSlug.set(e.slug, e);
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
