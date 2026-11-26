import type { Almacen } from "./almacen";
import { SEMILLA, tablaCon, type LugarConocido, type TablaLugares } from "./lugares";

/**
 * Los lugares habituales. Con base de datos viven en ella; la primera vez, que está vacía, se rellena con
 * la semilla (data/lugares.json) para no empezar de cero. En local son el propio data/lugares.json.
 */
export async function lugaresHabituales(a: Almacen): Promise<LugarConocido[]> {
  const actuales = await a.lugares();
  if (actuales.length || a.tipo === "local") return actuales;
  for (const l of SEMILLA.lugares) await a.guardarLugar(l);
  return a.lugares();
}

/** Lo que necesita el formulario para situar un sitio: concellos (del fichero) y lugares (de la base de datos) */
export async function tablaDeLugares(a: Almacen): Promise<TablaLugares> {
  return tablaCon(await lugaresHabituales(a));
}
