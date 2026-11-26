// Lugares habituales: sitios conocidos con sus coordenadas, para elegirlos al revisar un evento sin escribir nada.
// Viven en la base de datos (se editan en /admin/lugares); data/lugares.json es la semilla inicial
// y, sin base de datos (desarrollo local), el sitio donde se guardan.
import lugaresJSON from "../../data/lugares.json";
import { normalizar } from "./importar/ubicar";

export type LugarConocido = { nombre: string; concello: string; parroquia?: string; direccion?: string; lat: number; lng: number; aprox?: boolean };
export type ConcelloConocido = { lat: number; lng: number; parroquias: string[] };
export type TablaLugares = { _nota?: string; concellos: Record<string, ConcelloConocido>; lugares: LugarConocido[] };

/** Identifica un lugar: su concello y su nombre, sin tildes ni mayúsculas */
export const claveLugar = (nombre: string, concello: string) => `${normalizar(concello)}|${normalizar(nombre)}`;

export const SEMILLA: TablaLugares = lugaresJSON as TablaLugares;

/** La tabla que usa el formulario: concellos del fichero y lugares de la base de datos (o de la semilla si aún no hay) */
export function tablaCon(lugares: LugarConocido[]): TablaLugares {
  return { concellos: SEMILLA.concellos, lugares };
}

/** ¿Es el mismo lugar con los mismos datos? (para no reescribir lo que no ha cambiado) */
export const mismoLugar = (a: LugarConocido, b: LugarConocido) =>
  claveLugar(a.nombre, a.concello) === claveLugar(b.nombre, b.concello) &&
  a.lat === b.lat &&
  a.lng === b.lng &&
  (a.direccion ?? "") === (b.direccion ?? "") &&
  (a.parroquia ?? "") === (b.parroquia ?? "") &&
  !!a.aprox === !!b.aprox;
