// La cola de pendientes del panel: filtros, orden y vecinos (anterior/siguiente) para revisar uno tras otro.
import type { Pendiente } from "../almacen";
import { MARCA_POR_COMPLETAR } from "../sin-ia";
import { enlaceOrigen, sinHora } from "./origen";
import { emisorDe } from "./reglas";

export type FiltroCola = { emisor?: string; ver?: string };

export const esDuplicado = (p: Pendiente) => p.duplicados.length > 0;
export const esPorCompletar = (p: Pendiente) => !!p.evento.inferido?.includes(MARCA_POR_COMPLETAR);
export const esSinEnlace = (p: Pendiente) => !enlaceOrigen(p.evento);
export const esSinImagen = (p: Pendiente) => !p.cartel;
export const esSinHora = (p: Pendiente) => sinHora(p.evento);

/** Filtros de «ver»: clave en la URL → condición */
export const VER: Record<string, (p: Pendiente) => boolean> = {
  duplicados: esDuplicado,
  completar: esPorCompletar,
  sinenlace: esSinEnlace,
  sinimagen: esSinImagen,
  sinhora: esSinHora,
};

/** Los más próximos primero: son los que hay que publicar antes */
export function ordenarCola(todos: Pendiente[]): Pendiente[] {
  return [...todos].sort((x, y) => (x.evento.sesiones[0]?.inicio ?? "9").localeCompare(y.evento.sesiones[0]?.inicio ?? "9"));
}

export function filtrarCola(ordenados: Pendiente[], { emisor, ver }: FiltroCola): Pendiente[] {
  return ordenados
    .filter((p) => (emisor ? emisorDe(p) === emisor : true))
    .filter((p) => (ver && VER[ver] ? VER[ver](p) : true));
}

/** Solo valores simples, para ponerlos en una URL sin riesgo */
export function filtroSeguro(emisor?: string, ver?: string): FiltroCola {
  return { emisor: emisor && /^[a-z0-9-]+$/.test(emisor) ? emisor : undefined, ver: ver && /^[a-z]+$/.test(ver) ? ver : undefined };
}

export function consultaFiltro(f: FiltroCola): string {
  const q = new URLSearchParams();
  if (f.emisor) q.set("emisor", f.emisor);
  if (f.ver) q.set("ver", f.ver);
  return q.size ? `?${q}` : "";
}

/** Anterior y siguiente de `id` en la cola. Si `id` ya no está (acaba de publicarse o descartarse), `posicion` ayuda a saltar al que ocupa su sitio. */
export function vecinos(cola: Pendiente[], id: string): { anterior?: Pendiente; siguiente?: Pendiente; indice: number } {
  const indice = cola.findIndex((p) => p.id === id);
  if (indice < 0) return { indice, siguiente: cola[0] };
  return { indice, anterior: cola[indice - 1], siguiente: cola[indice + 1] ?? cola[indice - 1] };
}
