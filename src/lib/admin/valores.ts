// Valores iniciales del formulario de revisión a partir de un evento (pendiente o publicado).
import type { Almacen } from "../almacen";
import { SEMILLA } from "../lugares";
import { lugaresHabituales } from "../lugares-datos";
import type { Valores } from "@/app/admin/[id]/FormularioRevision";
import type { EventoBorrador } from "../tipos";
import { lugaresAFilas, sesionesAFilas } from "./formulario";

export function valoresDe(e: EventoBorrador): Valores {
  return {
    slug: e.slug,
    titulo: e.titulo,
    titulo_gl: e.titulo_gl ?? "",
    resumen: e.resumen,
    sesiones: sesionesAFilas(e.sesiones),
    lugares: lugaresAFilas(e.lugares),
    concello: e.concello,
    parroquia: e.parroquia ?? "",
    organizadores: e.organizadores.join(", "),
    categorias: e.categorias,
    publico: e.publico ?? "",
    precio: e.precio ?? "",
    idioma: e.idioma,
    inscripcion_url: e.inscripcion?.url ?? "",
    inscripcion_telefono: e.inscripcion?.telefono ?? "",
    inscripcion_email: e.inscripcion?.email ?? "",
    inscripcion_hasta: e.inscripcion?.hasta ?? "",
    extras: (e.extras ?? []).join("\n"),
    inferido: (e.inferido ?? []).join("\n"),
    recurrente: !!e.recurrente,
    comercial: !!e.comercial,
    destacado_hasta: e.destacado_hasta ?? "",
  };
}

/** Datos de apoyo del formulario: concellos y parroquias (data/lugares.json) y los lugares habituales (base de datos) */
export async function apoyoFormulario(a: Almacen) {
  return {
    concellos: Object.keys(SEMILLA.concellos),
    parroquias: [...new Set(Object.values(SEMILLA.concellos).flatMap((c) => c.parroquias))].sort(),
    lugaresConocidos: await lugaresHabituales(a),
  };
}
