// Valores iniciales del formulario de revisión a partir de un evento (pendiente o publicado).
import lugaresJSON from "../../../data/lugares.json";
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
  };
}

/** Datos de apoyo del formulario: concellos, parroquias y sitios conocidos (data/lugares.json) */
export const apoyoFormulario = {
  concellos: Object.keys(lugaresJSON.concellos),
  parroquias: [...new Set(Object.values(lugaresJSON.concellos).flatMap((c) => c.parroquias))].sort(),
  lugaresConocidos: lugaresJSON.lugares.map((l) => l.nombre),
};
