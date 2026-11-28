// Marca altofalante: «a "o" que fala». La «o» de «alto» es la membrana del altavoz; fuera del nombre, ese mismo
// círculo es el símbolo, el icono de la app y el marcador del mapa. Todo sale de aquí (componentes, iconos con
// `npm run logos`, imagen para compartir y mapa), así que cambiar un color o una proporción se hace en un solo sitio.

export const COLORES = {
  rojo: "#e2452b", // color de marca
  tinta: "#16181d", // casi negro
  crema: "#f4f1ea", // fondo
  blanco: "#ffffff",
} as const;

/** Símbolo base en un lienzo de 100: anillo oscuro, hueco blanco y punto rojo */
export function svgSimbolo({ anillo = COLORES.tinta, hueco = COLORES.blanco, punto = COLORES.rojo } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${anillo}"/><circle cx="50" cy="50" r="33" fill="${hueco}"/><circle cx="50" cy="50" r="14" fill="${punto}"/></svg>`;
}

/**
 * Icono de app: cuadrado rojo a sangre (iOS y Android ponen sus esquinas) con el símbolo en blanco, rojo y tinta.
 * `zona` es la parte del lado que ocupa el símbolo (más pequeña en los iconos adaptables, que se recortan en círculo).
 */
export function svgIconoApp({ redondeo = 0, zona = 0.56 } = {}): string {
  const r = 50 * zona;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${redondeo}" fill="${COLORES.rojo}"/><circle cx="50" cy="50" r="${r}" fill="${COLORES.blanco}"/><circle cx="50" cy="50" r="${r * 0.62}" fill="${COLORES.rojo}"/><circle cx="50" cy="50" r="${r * 0.3}" fill="${COLORES.tinta}"/></svg>`;
}

/** Marcador del mapa: gota oscura con el símbolo dentro (36×48, la punta abajo en el centro) */
export function svgMarcador({ fondo = COLORES.tinta } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48"><path d="M18 47C18 47 2 29.5 2 18a16 16 0 0 1 32 0C34 29.5 18 47 18 47Z" fill="${fondo}" stroke="#fff" stroke-width="2"/><circle cx="18" cy="18" r="9.5" fill="#fff"/><circle cx="18" cy="18" r="4.5" fill="${COLORES.rojo}"/></svg>`;
}
