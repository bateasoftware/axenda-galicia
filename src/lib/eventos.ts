import "server-only";
import path from "node:path";
import type { Evento } from "./tipos";
import { primerInicio } from "./fechas";
import { formatearProblemas, leerEventos } from "./validacion";
import { slugConcello } from "./slug";

export { slugConcello };

// Fase 1: los eventos viven como JSON en /data/eventos (git como CMS).
// Fase 2: sustituir estas funciones por consultas a Supabase sin tocar las vistas.
const RAIZ = process.cwd();
const DIR = path.join(RAIZ, "data", "eventos");

let cache: Evento[] | null = null;

export function todosLosEventos(): Evento[] {
  // En desarrollo se relee en cada petición para ver al momento los JSON editados
  if (cache && process.env.NODE_ENV === "production") return cache;
  const { eventos, problemas } = leerEventos(DIR, RAIZ);
  // Un evento mal formado hace fallar el build con un mensaje claro, en vez de romper una vista
  if (problemas.length) {
    throw new Error(`Hay eventos no válidos en data/eventos (ejecuta npm run validar):\n${formatearProblemas(problemas)}`);
  }
  cache = eventos.sort((a, b) => primerInicio(a).localeCompare(primerInicio(b)));
  return cache;
}

export function eventoPorSlug(slug: string): Evento | undefined {
  return todosLosEventos().find((e) => e.slug === slug);
}

export function concellos(): { nombre: string; slug: string; total: number }[] {
  const m = new Map<string, number>();
  for (const e of todosLosEventos()) m.set(e.concello, (m.get(e.concello) ?? 0) + 1);
  return [...m.entries()]
    .map(([nombre, total]) => ({ nombre, slug: slugConcello(nombre), total }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
