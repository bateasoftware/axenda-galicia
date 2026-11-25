import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATEGORIAS } from "../categorias";
import { concellos, organizadores, todosLosEventos } from "../eventos";
import { fechaHoraGalicia } from "../fechas";
import type { Categoria } from "../tipos";
import { almacenMetricas } from "./almacen";
import { comparativaDestacados, ctr, desdeHace, ranking, totales } from "./informes";

export const DIAS_MEDIAKIT = 30;

/** Cifras reales para /anunciate: últimos 30 días de métricas propias y lo publicado ahora. Se recalcula cada hora. */
export async function cifrasMediaKit() {
  "use cache";
  cacheTag("mediakit");
  cacheLife("hours");
  const hoy = fechaHoraGalicia().slice(0, 10);
  const desde = desdeHace(hoy, DIAS_MEDIAKIT);
  const metricas = almacenMetricas();
  const filas = metricas ? await metricas.leer(desde).catch(() => []) : [];
  const t = totales(filas);
  const { destacado, normal } = comparativaDestacados(filas);
  const ctrD = ctr(destacado, 200);
  const ctrN = ctr(normal, 200);
  return {
    desde,
    hoy,
    vistas: t.vista,
    apariciones: t.impresion,
    acciones: t["como-llegar"] + t.calendario + t.inscripcion + t.compartir,
    comoLlegar: t["como-llegar"],
    eventos: (await todosLosEventos()).length,
    organizadores: (await organizadores()).length,
    concellos: (await concellos()).map((c) => c.nombre),
    categorias: ranking(filas, "categoria")
      .filter((r) => r.t.vista > 0)
      .slice(0, 4)
      .map((r) => CATEGORIAS[r.clave as Categoria]?.nombre ?? r.clave),
    // Solo si hay datos suficientes de los dos grupos para que la comparación sea honesta
    mejoraDestacado: ctrD !== null && ctrN !== null && ctrN > 0 ? Math.round((ctrD / ctrN) * 10) / 10 : null,
  };
}
