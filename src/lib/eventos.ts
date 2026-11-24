import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Evento } from "./tipos";
import { primerInicio } from "./fechas";

// Fase 1: los eventos viven como JSON en /data/eventos (git como CMS).
// Fase 2: sustituir estas funciones por consultas a Supabase sin tocar las vistas.
const DIR = path.join(process.cwd(), "data", "eventos");

let cache: Evento[] | null = null;

export function todosLosEventos(): Evento[] {
  if (cache) return cache;
  const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  cache = ficheros
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Evento)
    .sort((a, b) => primerInicio(a).localeCompare(primerInicio(b)));
  return cache;
}

export function eventoPorSlug(slug: string): Evento | undefined {
  return todosLosEventos().find((e) => e.slug === slug);
}

export function slugConcello(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export function concellos(): { nombre: string; slug: string; total: number }[] {
  const m = new Map<string, number>();
  for (const e of todosLosEventos()) m.set(e.concello, (m.get(e.concello) ?? 0) + 1);
  return [...m.entries()]
    .map(([nombre, total]) => ({ nombre, slug: slugConcello(nombre), total }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
