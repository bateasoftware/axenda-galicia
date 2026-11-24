// Asigna concello, parroquia y coordenadas a un texto de lugar usando data/lugares.json.
import lugaresJSON from "../../../data/lugares.json";
import type { Lugar } from "../tipos";

type TablaLugares = {
  concellos: Record<string, { lat: number; lng: number; parroquias: string[] }>;
  lugares: { nombre: string; direccion?: string; concello: string; parroquia?: string; lat: number; lng: number; aprox?: boolean }[];
};

export type Ubicacion = { concello: string; parroquia?: string; lugar: Lugar };

export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** ¿Aparece la frase entera (por palabras) dentro del texto? */
const contiene = (texto: string, frase: string) => ` ${normalizar(texto)} `.includes(` ${normalizar(frase)} `);

/**
 * Busca, por este orden: un lugar conocido, una parroquia, el nombre del concello.
 * Devuelve null si el texto no es de ninguno de nuestros concellos.
 */
export function ubicar(texto: string | undefined, tabla: TablaLugares = lugaresJSON as TablaLugares): Ubicacion | null {
  if (!texto?.trim()) return null;
  const nombreLugar = texto.split(/ - |,/)[0].trim() || texto.trim();

  // 1. Lugar conocido (el nombre más largo gana: "Auditorio Municipal de Nigrán" antes que "Nigrán")
  const conocido = [...tabla.lugares].sort((a, b) => b.nombre.length - a.nombre.length).find((l) => contiene(texto, l.nombre));
  if (conocido)
    return {
      concello: conocido.concello,
      parroquia: conocido.parroquia,
      lugar: {
        nombre: conocido.nombre,
        ...(conocido.direccion ? { direccion: conocido.direccion } : {}),
        lat: conocido.lat,
        lng: conocido.lng,
        ...(conocido.aprox ? { aprox: true } : {}),
      },
    };

  // 2. Concello por nombre (en el ICS de Cultura de Galicia: "Lugar - Concello - Provincia")
  const concellos = Object.entries(tabla.concellos);
  const porNombre = concellos.find(([nombre]) => contiene(texto, nombre));

  // 3. Parroquia (solo si no contradice al concello encontrado)
  for (const [nombre, c] of concellos) {
    if (porNombre && porNombre[0] !== nombre) continue;
    const parroquia = c.parroquias.find((p) => normalizar(p) !== normalizar(nombre) && contiene(texto, p));
    if (parroquia) return { concello: nombre, parroquia, lugar: { nombre: nombreLugar, lat: c.lat, lng: c.lng, aprox: true } };
  }

  if (porNombre) {
    const [nombre, c] = porNombre;
    return { concello: nombre, lugar: { nombre: nombreLugar, lat: c.lat, lng: c.lng, aprox: true } };
  }
  return null;
}
