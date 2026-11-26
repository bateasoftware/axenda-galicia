"use server";

import { revalidatePath } from "next/cache";
import { almacen } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { parsearCoordenadas } from "@/lib/coordenadas";
import type { LugarConocido } from "@/lib/lugares";

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
  await almacen().guardarLugar(lugar, anterior);
  revalidatePath("/admin/lugares");
  return { tipo: "ok", mensaje: `Guardado «${nombre}». Los eventos nuevos ya lo encontrarán; los publicados conservan sus coordenadas.` };
}

export async function borrarLugar(nombre: string, concello: string) {
  await exigirAdmin();
  await almacen().borrarLugar(nombre, concello);
  revalidatePath("/admin/lugares");
}
