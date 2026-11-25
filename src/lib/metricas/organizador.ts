import "server-only";
import { organizadores, slugConcello, todosLosEventos } from "../eventos";
import { primerInicio } from "../fechas";
import type { Evento } from "../tipos";
import { almacenMetricas } from "./almacen";
import { totales, totalesVacios, type Totales } from "./informes";

export type InformeOrganizador = {
  nombre: string;
  eventos: { evento: Evento; t: Totales }[];
  total: Totales;
  /** Hay base de datos de métricas */
  conDatos: boolean;
};

/** Cifras de todos los eventos (publicados ahora) de un organizador, desde el principio */
export async function informeOrganizador(slug: string): Promise<InformeOrganizador | null> {
  const org = (await organizadores()).find((o) => o.slug === slug);
  if (!org) return null;
  const suyos = (await todosLosEventos()).filter((e) => e.organizadores.some((o) => slugConcello(o) === slug));
  const metricas = almacenMetricas();
  const filas = metricas ? await metricas.leer("0000-01-01", { ambito: "evento" }).catch(() => []) : [];
  const eventos = suyos
    .map((e) => ({ evento: e, t: totales(filas, "evento", e.slug) }))
    .sort((a, b) => primerInicio(b.evento).localeCompare(primerInicio(a.evento)));
  const total = totalesVacios();
  for (const { t } of eventos) for (const k of Object.keys(t) as (keyof Totales)[]) total[k] += t[k];
  return { nombre: org.nombre, eventos, total, conDatos: !!metricas };
}
