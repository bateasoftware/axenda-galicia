// Qué se acepta en /api/m: solo navegadores, desde nuestras páginas, con tipos y slugs válidos.
import { esBot, TIPOS, type TipoMetrica } from "./modelo";

export const MAX_POR_PETICION = 80;
const RE_SLUG = /^[a-z0-9-]{1,90}$/;

/**
 * Devuelve los pares (tipo, slug) que hay que contar, o `estado` si la petición se descarta
 * (204: no cuenta pero no es un error; 400: cuerpo mal formado).
 */
export function leerPeticion(cab: Headers, cuerpo: string): { pares: [TipoMetrica, string][] } | { estado: 204 | 400 } {
  if (esBot(cab.get("user-agent"))) return { estado: 204 };
  // Solo desde nuestras propias páginas (evita que otra web infle las cifras)
  const origen = cab.get("origin") ?? cab.get("referer");
  const host = cab.get("x-forwarded-host") ?? cab.get("host");
  try {
    if (!origen || !host || new URL(origen).host !== host) return { estado: 204 };
  } catch {
    return { estado: 204 };
  }
  let e: unknown;
  try {
    e = (JSON.parse(cuerpo) as { e?: unknown }).e;
  } catch {
    return { estado: 400 };
  }
  if (!Array.isArray(e)) return { estado: 400 };
  const pares = e
    .slice(0, MAX_POR_PETICION)
    .filter((p): p is [TipoMetrica, string] => Array.isArray(p) && TIPOS.includes(p[0]) && typeof p[1] === "string" && RE_SLUG.test(p[1]));
  return pares.length ? { pares } : { estado: 204 };
}
