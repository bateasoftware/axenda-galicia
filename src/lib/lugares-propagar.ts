// Al cambiar un lugar habitual en /admin/lugares, los eventos que lo usan (publicados y pendientes) se actualizan:
// así se revisan las coordenadas de todos de una vez, desde el mapa de lugares.
import type { Almacen } from "./almacen";
import { claveLugar, type LugarConocido } from "./lugares";
import type { Evento, EventoBorrador, Lugar } from "./tipos";

/**
 * El evento con el lugar cambiado, o null si no lo usa o ya estaba igual.
 * Un evento usa el lugar si alguno de sus sitios se llama igual (sin tildes ni mayúsculas) y es del mismo concello;
 * se compara con el nombre anterior y con el nuevo (así también se arreglan los eventos de un lugar recién creado).
 */
export function aplicarLugar<E extends Pick<EventoBorrador, "concello" | "lugares">>(e: E, lugar: LugarConocido, anterior?: { nombre: string; concello: string }): E | null {
  const claves = new Set([claveLugar(lugar.nombre, lugar.concello), ...(anterior ? [claveLugar(anterior.nombre, anterior.concello)] : [])]);
  let cambia = false;
  const lugares = e.lugares.map((l): Lugar => {
    if (!claves.has(claveLugar(l.nombre, e.concello))) return l;
    const { aprox: _a, ...resto } = l;
    void _a;
    const nuevo: Lugar = {
      ...resto,
      nombre: lugar.nombre,
      lat: lugar.lat,
      lng: lugar.lng,
      ...(lugar.direccion ? { direccion: lugar.direccion } : {}),
      ...(lugar.aprox ? { aprox: true } : {}),
    };
    if (JSON.stringify(nuevo) !== JSON.stringify(l)) cambia = true;
    return nuevo;
  });
  return cambia ? { ...e, lugares } : null;
}

/**
 * Aplica el lugar a todos los eventos publicados y a los pendientes. `repositorio` son los de data/eventos
 * (eventosDelRepositorio): con base de datos, los que cambian se copian a ella y ganan al fichero.
 */
export async function propagarLugar(
  a: Almacen,
  lugar: LugarConocido,
  anterior: { nombre: string; concello: string } | undefined,
  repositorio: Evento[] = [],
): Promise<{ publicados: number; pendientes: number }> {
  let publicados = 0;
  let pendientes = 0;
  const enAlmacen = await a.publicadosConId();
  for (const p of enAlmacen) {
    const nuevo = aplicarLugar(p.evento, lugar, anterior);
    if (!nuevo) continue;
    await a.guardarPublicado(p.id, nuevo);
    publicados++;
  }
  // Con base de datos, los de data/eventos que siguen en la web se copian a ella con el cambio (ganan al fichero)
  if (a.tipo !== "local") {
    const enNube = new Set(enAlmacen.map((p) => p.evento.slug));
    const retirados = new Set(await a.slugsRetirados());
    for (const e of repositorio) {
      if (enNube.has(e.slug) || retirados.has(e.slug)) continue;
      const nuevo = aplicarLugar(e, lugar, anterior);
      if (!nuevo) continue;
      await a.adoptar(nuevo);
      publicados++;
    }
  }
  for (const p of await a.pendientes()) {
    const nuevo = aplicarLugar(p.evento, lugar, anterior);
    if (!nuevo) continue;
    await a.guardar(p.id, nuevo);
    pendientes++;
  }
  return { publicados, pendientes };
}
