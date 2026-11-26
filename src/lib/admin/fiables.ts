import reglasJSON from "../../../data/reglas.json";
import type { Almacen, Pendiente } from "../almacen";
import { slugLibre } from "../almacen";
import { todosLosEventos } from "../eventos";
import { ReglasSchema, historialPorEmisor, pendientesDeConfianza, type Regla } from "./reglas";

export const REGLAS: Regla[] = ReglasSchema.parse(reglasJSON).autopublicar;

/** Pendientes que cumplen alguna regla de data/reglas.json (con la misma comprobación que el lote). Sin reglas, ni consulta la base de datos. */
export async function fiablesAhora(a: Almacen, pendientes: Pendiente[]): Promise<Pendiente[]> {
  if (!REGLAS.length || !pendientes.length) return [];
  const [registros, publicados] = await Promise.all([a.cobertura(), todosLosEventos()]);
  const ocupados = new Set(publicados.map((e) => e.slug));
  return pendientesDeConfianza(pendientes, REGLAS, historialPorEmisor(registros), (s) => ocupados.has(s), slugLibre);
}
