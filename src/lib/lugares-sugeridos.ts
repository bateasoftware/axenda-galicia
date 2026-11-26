// Lugares que salen en los eventos y aún no están en data/lugares.json (o que ahí siguen aproximados
// aunque algún evento ya trae coordenadas exactas). Sirve para ir completando la tabla de sitios,
// que es un activo del proyecto: cuanto más completa, mejor mapa y menos trabajo al revisar.
import { normalizar } from "./importar/ubicar";
import type { Lugar } from "./tipos";

export type LugarConocido = { nombre: string; concello: string; lat: number; lng: number; direccion?: string; aprox?: boolean };
export type TablaLugares = { _nota?: string; concellos: Record<string, unknown>; lugares: LugarConocido[] };
export type EventoConLugares = { concello: string; lugares: Lugar[] };

export type Sugerencia = {
  tipo: "nuevo" | "afinar";
  nombre: string;
  concello: string;
  lat: number;
  lng: number;
  aprox: boolean;
  direccion?: string;
  /** Cuántos eventos lo usan */
  usos: number;
};

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const redondear = (n: number) => Math.round(n * 1e5) / 1e5;
const clave = (nombre: string, concello: string) => `${normalizar(concello)}|${normalizar(nombre)}`;

export function sugerirLugares(eventos: EventoConLugares[], tabla: TablaLugares): Sugerencia[] {
  const grupos = new Map<string, { nombre: string; concello: string; puntos: Lugar[] }>();
  for (const e of eventos)
    for (const l of e.lugares) {
      if (!normalizar(l.nombre)) continue;
      const k = clave(l.nombre, e.concello);
      const g = grupos.get(k) ?? { nombre: l.nombre.trim(), concello: e.concello, puntos: [] };
      g.puntos.push(l);
      grupos.set(k, g);
    }
  const conocidos = new Map(tabla.lugares.map((l) => [clave(l.nombre, l.concello), l]));
  const resultado: Sugerencia[] = [];
  for (const [k, g] of grupos) {
    const exactos = g.puntos.filter((p) => !p.aprox);
    // Si hay coordenadas exactas se usan solo esas; si no, las aproximadas
    const base = exactos.length ? exactos : g.puntos;
    const datos = {
      nombre: g.nombre,
      concello: g.concello,
      lat: redondear(mediana(base.map((p) => p.lat))),
      lng: redondear(mediana(base.map((p) => p.lng))),
      aprox: !exactos.length,
      direccion: g.puntos.find((p) => p.direccion)?.direccion,
      usos: g.puntos.length,
    };
    const conocido = conocidos.get(k);
    if (!conocido) resultado.push({ tipo: "nuevo", ...datos });
    else if (conocido.aprox && !datos.aprox) resultado.push({ tipo: "afinar", ...datos, nombre: conocido.nombre });
  }
  return resultado.sort((a, b) => b.usos - a.usos || a.concello.localeCompare(b.concello) || a.nombre.localeCompare(b.nombre));
}

/**
 * Aplica sugerencias a la tabla. Un lugar con coordenadas solo aproximadas se añade únicamente si se usa
 * en `minimoAprox` eventos o más (si no, solo ensucia la lista de nombres).
 */
export function aplicarSugerencias(tabla: TablaLugares, sugerencias: Sugerencia[], minimoAprox = 2): { tabla: TablaLugares; anadidos: number; afinados: number } {
  const lugares = tabla.lugares.map((l) => ({ ...l }));
  let anadidos = 0;
  let afinados = 0;
  for (const s of sugerencias) {
    if (s.tipo === "nuevo") {
      if (s.aprox && s.usos < minimoAprox) continue;
      lugares.push({ nombre: s.nombre, concello: s.concello, lat: s.lat, lng: s.lng, ...(s.direccion ? { direccion: s.direccion } : {}), ...(s.aprox ? { aprox: true } : {}) });
      anadidos++;
    } else {
      const l = lugares.find((x) => clave(x.nombre, x.concello) === clave(s.nombre, s.concello));
      if (!l) continue;
      l.lat = s.lat;
      l.lng = s.lng;
      if (s.direccion && !l.direccion) l.direccion = s.direccion;
      delete l.aprox;
      afinados++;
    }
  }
  lugares.sort((a, b) => a.concello.localeCompare(b.concello) || a.nombre.localeCompare(b.nombre));
  return { tabla: { ...tabla, lugares }, anadidos, afinados };
}
