// Coordenadas en el formato que da Google Maps al hacer clic derecho sobre un sitio: «42.1115, -8.7608»
// (latitud, longitud). Se aceptan también espacios, coma decimal y enlaces de Google Maps.

export type Coordenadas = { lat: number; lng: number };

// Un cuadro que cubre Galicia con margen: sirve para cazar el error típico de poner longitud primero
const LAT = [41.6, 44.0] as const;
const LNG = [-9.6, -6.6] as const;
const enGalicia = (lat: number, lng: number) => lat >= LAT[0] && lat <= LAT[1] && lng >= LNG[0] && lng <= LNG[1];

const num = (s: string) => Number(s.replace(",", "."));

/** Los dos números de un texto (con o sin enlace de Google Maps alrededor) */
function extraer(texto: string): [number, number] | null {
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

export function parsearCoordenadas(texto: string): Coordenadas | { error: string } {
  const par = extraer(texto);
  if (!par) return { error: "no entiendo las coordenadas: pega las de Google Maps, tal cual (por ejemplo 42.1115, -8.7608)" };
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
