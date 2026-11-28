// Coordenadas en el formato que da Google Maps al hacer clic derecho sobre un sitio: «42.1115, -8.7608»
// (latitud, longitud). Se aceptan también espacios, coma decimal, enlaces de Google Maps y plus codes
// («8CJ44XM3+PX», o el corto que enseña Google Maps: «4XM3+PX Vigo»).

export type Coordenadas = { lat: number; lng: number };

// Un cuadro que cubre Galicia con margen: sirve para cazar el error típico de poner longitud primero
const LAT = [41.6, 44.0] as const;
const LNG = [-9.6, -6.6] as const;
const enGalicia = (lat: number, lng: number) => lat >= LAT[0] && lat <= LAT[1] && lng >= LNG[0] && lng <= LNG[1];

// Plus code (Open Location Code), sin dependencias: https://github.com/google/open-location-code
const ALFABETO = "23456789CFGHJMPQRVWX";
const RESOLUCION = [20, 1, 0.05, 0.0025, 0.000125];
/** Los plus codes cortos («4XM3+PX») no llevan los primeros caracteres: se completan con el sitio más cercano a este punto (Val Miñor y Vigo) */
export const REFERENCIA_PLUS_CODE: Coordenadas = { lat: 42.15, lng: -8.75 };

function esPlusCode(texto: string): string | null {
  // «4XM3+PX Vigo, Pontevedra» → «4XM3+PX»: lo que va detrás del código es el nombre del lugar
  const m = texto.trim().toUpperCase().match(/^([23456789CFGHJMPQRVWX]{2,8})\+([23456789CFGHJMPQRVWX]{2,})?(?=\s|,|$)/);
  if (!m) return null;
  if (m[1].length % 2 || (m[1].length < 8 && !m[2])) return null;
  return `${m[1]}+${m[2] ?? ""}`;
}

function decodificar(codigo: string, ref: Coordenadas): [number, number] {
  const [antes, despues] = codigo.split("+");
  const falta = 8 - antes.length;
  let sumaLat = 0;
  let sumaLng = 0;
  const pares = (antes + despues).slice(0, 10);
  // Corto: se anteponen los caracteres del punto de referencia
  let prefLat = 0;
  let prefLng = 0;
  if (falta > 0) {
    const r = [ref.lat + 90, ref.lng + 180];
    for (let i = 0; i < falta / 2; i++) {
      prefLat += Math.floor(r[0] / RESOLUCION[i]) * RESOLUCION[i];
      r[0] %= RESOLUCION[i];
      prefLng += Math.floor(r[1] / RESOLUCION[i]) * RESOLUCION[i];
      r[1] %= RESOLUCION[i];
    }
  }
  for (let i = 0; i < pares.length; i += 2) {
    const k = i / 2 + falta / 2;
    sumaLat += ALFABETO.indexOf(pares[i]) * RESOLUCION[k];
    sumaLng += ALFABETO.indexOf(pares[i + 1] ?? "2") * RESOLUCION[k];
  }
  const ultima = RESOLUCION[Math.min(4, pares.length / 2 - 1 + falta / 2)];
  let lat = prefLat + sumaLat + ultima / 2 - 90;
  let lng = prefLng + sumaLng + ultima / 2 - 180;
  if (falta > 0) {
    // Entre las celdas vecinas, la más cercana a la referencia
    const celda = RESOLUCION[falta / 2 - 1];
    if (lat > ref.lat + celda / 2) lat -= celda;
    else if (lat < ref.lat - celda / 2) lat += celda;
    if (lng > ref.lng + celda / 2) lng -= celda;
    else if (lng < ref.lng - celda / 2) lng += celda;
  }
  return [lat, lng];
}

/** Plus code (completo o corto) → latitud y longitud, sin comprobar que caigan en Galicia. null si el texto no es un plus code. */
export function plusCodeACoordenadas(texto: string, ref: Coordenadas = REFERENCIA_PLUS_CODE): [number, number] | null {
  const c = esPlusCode(texto);
  return c ? decodificar(c, ref) : null;
}

const num = (s: string) => Number(s.replace(",", "."));

/** Los dos números de un texto (con o sin enlace de Google Maps alrededor) */
function extraer(texto: string, ref: Coordenadas): [number, number] | null {
  const plus = esPlusCode(texto);
  if (plus) return decodificar(plus, ref);
  const t = texto.trim().replace(/[°º]/g, "");
  // Enlaces de Google Maps: .../@42.11,-8.76,17z · ...!3d42.11!4d-8.76 · ?q=42.11,-8.76 · ?ll=42.11,-8.76
  const enlace = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? t.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/);
  if (enlace) return [Number(enlace[1]), Number(enlace[2])];
  // «42.1115, -8.7608» · «42.1115 -8.7608» · «42,1115; -8,7608»
  const partes = t.split(/\s*;\s*|\s*,\s+|\s+/).filter(Boolean);
  if (partes.length === 2 && partes.every((p) => /^-?\d+(?:[.,]\d+)?$/.test(p))) return [num(partes[0]), num(partes[1])];
  // «42.1115,-8.7608» (coma sin espacio, con puntos decimales)
  const junta = t.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (junta) return [Number(junta[1]), Number(junta[2])];
  return null;
}

export function parsearCoordenadas(texto: string, referencia: Coordenadas = REFERENCIA_PLUS_CODE): Coordenadas | { error: string } {
  const par = extraer(texto, referencia);
  if (!par) return { error: "no entiendo las coordenadas: pega las de Google Maps (por ejemplo 42.1115, -8.7608) o su plus code (por ejemplo 8CJ44XM3+PX)" };
  const [lat, lng] = par;
  if (enGalicia(lat, lng)) return { lat, lng };
  if (enGalicia(lng, lat)) return { error: "parece que están al revés: primero va la latitud (42.1…) y luego la longitud (-8.7…)" };
  return { error: "esas coordenadas no caen en Galicia: revisa que las has copiado bien" };
}

const redondear = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** «42.1115, -8.7608»: lo que se pega en Google Maps para encontrar el sitio */
export const formatoCoordenadas = (lat: number, lng: number) => `${redondear(lat)}, ${redondear(lng)}`;

/** Ver unas coordenadas en Google Maps */
export const enlaceCoordenadas = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${redondear(lat)}%2C${redondear(lng)}`;

/** Buscar un sitio por nombre en Google Maps (para copiar luego sus coordenadas) */
export const enlaceBuscarSitio = (nombre: string, concello?: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([nombre, concello, "Galicia"].filter(Boolean).join(", "))}`;
