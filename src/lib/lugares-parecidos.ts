// Nombres de lugar parecidos: «Auditorio de Nigrán» y «Auditorio Municipal de Nigrán», «Praza Paradela» y
// «Plaza de Paradela»… Sirve para sugerir el lugar habitual al revisar un evento y para unificar variantes.
// Nunca se cambia nada solo: se sugiere y una persona elige. Sin dependencias: se usa también en el navegador.
import type { LugarConocido } from "./lugares";

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Palabras que no distinguen un sitio de otro
const VACIAS = new Set("a o os as e y de del da do das dos en no na nos nas el la los las un una unha con para".split(" "));
// Gallego y castellano (y variantes) a una misma forma
const SINONIMOS: Record<string, string> = {
  praza: "plaza",
  pza: "plaza",
  pz: "plaza",
  rua: "calle",
  r: "calle",
  c: "calle",
  avda: "avenida",
  av: "avenida",
  igrexa: "iglesia",
  capela: "capilla",
  praia: "playa",
  porto: "puerto",
  colexio: "colegio",
  ceip: "colegio",
  cpi: "colegio",
  pavillon: "pabellon",
  polideportivo: "pabellon",
  concello: "ayuntamiento",
  casa: "casa",
  centro: "centro",
  cultural: "cultura",
  sociocultural: "cultura",
  municipal: "",
  municipais: "",
  municipales: "",
  mpal: "",
  cine: "cines",
  cinema: "cines",
  biblioteca: "biblioteca",
  mercado: "mercado",
  feira: "feria",
  campo: "campo",
  futbol: "futbol",
  xardin: "jardin",
  xardins: "jardin",
  xardines: "jardin",
};

function palabras(nombre: string): Set<string> {
  return new Set(
    normalizar(nombre)
      .split(" ")
      .filter((p) => p && !VACIAS.has(p))
      .map((p) => SINONIMOS[p] ?? p)
      .filter(Boolean),
  );
}

function bigramas(nombre: string): string[] {
  const t = [...palabras(nombre)].sort().join("");
  const r: string[] = [];
  for (let i = 0; i < t.length - 1; i++) r.push(t.slice(i, i + 2));
  return r;
}

/** Parecido de dos nombres de lugar, 0–1 */
export function parecidoLugares(a: string, b: string): number {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.size || !pb.size) return 0;
  const comunes = [...pa].filter((p) => pb.has(p)).length;
  if (comunes === pa.size && comunes === pb.size) return 1;
  const porPalabras = (2 * comunes) / (pa.size + pb.size);
  // Uno contiene todas las palabras del otro («Auditorio de Nigrán» ⊂ «Auditorio Municipal de Nigrán»)
  const contenido = comunes === Math.min(pa.size, pb.size) ? 0.8 : 0;
  const ba = bigramas(a);
  const resto = bigramas(b);
  const total = ba.length + resto.length;
  let c = 0;
  for (const x of ba) {
    const i = resto.indexOf(x);
    if (i >= 0) {
      c++;
      resto.splice(i, 1);
    }
  }
  const porLetras = total ? (2 * c) / total : 0;
  return Math.max(porPalabras, contenido, porLetras);
}

export const PARECIDO_MINIMO = 0.6;

/**
 * Lugares habituales con un nombre parecido (no igual) en el mismo concello, el más parecido primero.
 * Sin concello, se buscan en todos.
 */
export function lugaresParecidos(nombre: string, concello: string, lista: LugarConocido[], { max = 3, minimo = PARECIDO_MINIMO } = {}): LugarConocido[] {
  if (normalizar(nombre).length < 3) return [];
  return lista
    .filter((l) => !concello || normalizar(l.concello) === normalizar(concello))
    .filter((l) => normalizar(l.nombre) !== normalizar(nombre))
    .map((l) => ({ l, p: parecidoLugares(nombre, l.nombre) }))
    .filter((x) => x.p >= minimo)
    .sort((x, y) => y.p - x.p)
    .slice(0, max)
    .map((x) => x.l);
}
