"use server";

import { revalidatePath, updateTag } from "next/cache";
import { almacen } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { parsearCoordenadas } from "@/lib/coordenadas";
import { ETIQUETA_EVENTOS, eventosDelRepositorio } from "@/lib/eventos";
import { claveLugar, type LugarConocido } from "@/lib/lugares";
import { lugaresHabituales } from "@/lib/lugares-datos";
import { propagarLugar } from "@/lib/lugares-propagar";

export type EstadoLugar = { tipo: "inicial" } | { tipo: "error"; mensaje: string } | { tipo: "ok"; mensaje: string };

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Crea o cambia un lugar habitual. Si se cambia el nombre o el concello, se sustituye el anterior. */
export async function guardarLugar(_previo: EstadoLugar, f: FormData): Promise<EstadoLugar> {
  await exigirAdmin();
  const nombre = texto(f, "nombre");
  const concello = texto(f, "concello");
  if (!nombre) return { tipo: "error", mensaje: "Escribe el nombre del sitio." };
  if (!concello) return { tipo: "error", mensaje: "Elige el concello." };
  const c = parsearCoordenadas(texto(f, "coords"));
  if ("error" in c) return { tipo: "error", mensaje: `Coordenadas: ${c.error}. También puedes hacer clic en el mapa.` };
  const lugar: LugarConocido = {
    nombre,
    concello,
    ...(texto(f, "parroquia") ? { parroquia: texto(f, "parroquia") } : {}),
    ...(texto(f, "direccion") ? { direccion: texto(f, "direccion") } : {}),
    lat: c.lat,
    lng: c.lng,
    ...(f.get("aprox") === "1" ? { aprox: true } : {}),
  };
  const anterior = texto(f, "anterior_nombre") ? { nombre: texto(f, "anterior_nombre"), concello: texto(f, "anterior_concello") } : undefined;
  const a = almacen();
  await a.guardarLugar(lugar, anterior);
  // Los eventos que lo usan (publicados y pendientes) se actualizan con las coordenadas nuevas
  const n = await propagarLugar(a, lugar, anterior, eventosDelRepositorio());
  if (n.publicados) updateTag(ETIQUETA_EVENTOS);
  revalidatePath("/admin/lugares");
  const partes = [n.publicados && `${n.publicados} ${n.publicados === 1 ? "evento publicado" : "eventos publicados"}`, n.pendientes && `${n.pendientes} ${n.pendientes === 1 ? "pendiente" : "pendientes"}`].filter(Boolean);
  return {
    tipo: "ok",
    mensaje: `Guardado «${nombre}».${partes.length ? ` Actualizados ${partes.join(" y ")}${n.publicados ? " (la web cambia en unos segundos)" : ""}.` : " Ningún evento lo usaba todavía."}`,
  };
}

export async function borrarLugar(nombre: string, concello: string) {
  await exigirAdmin();
  await almacen().borrarLugar(nombre, concello);
  revalidatePath("/admin/lugares");
}

/**
 * Unifica una variante con un lugar habitual («Auditorio de Nigrán» → «Auditorio Municipal de Nigrán»):
 * los eventos que usan la variante pasan a usar el nombre, las coordenadas y la dirección del habitual.
 */
export async function unificarLugar(variante: string, concello: string, habitual: string): Promise<string> {
  await exigirAdmin();
  const a = almacen();
  const lugar = (await lugaresHabituales(a)).find((l) => claveLugar(l.nombre, l.concello) === claveLugar(habitual, concello));
  if (!lugar) return `No encuentro «${habitual}» en los lugares habituales.`;
  const n = await propagarLugar(a, lugar, { nombre: variante, concello }, eventosDelRepositorio());
  if (n.publicados) updateTag(ETIQUETA_EVENTOS);
  revalidatePath("/admin/lugares");
  const total = n.publicados + n.pendientes;
  return `«${variante}» unificado con «${lugar.nombre}»: ${total} ${total === 1 ? "evento actualizado" : "eventos actualizados"}.`;
}
