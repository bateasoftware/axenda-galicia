import { almacenLocal } from "./local";
import { almacenSupabase, supabaseConfigurado } from "./supabase";
import { almacenTurso, clienteTurso, subirCartelBlob, tursoConfigurado } from "./turso";

/** Turso, con los carteles en la base de datos (o en Vercel Blob si está su token) */
export function almacenTursoDesdeEnv(env: Record<string, string | undefined> = process.env) {
  return almacenTurso({ cliente: () => clienteTurso(env), subirCartel: env.BLOB_READ_WRITE_TOKEN ? subirCartelBlob(env.BLOB_READ_WRITE_TOKEN) : undefined });
}
import type { Almacen } from "./tipos";

export * from "./tipos";
export { almacenLocal, limpiarSlug, slugLibre } from "./local";
export { almacenSupabase, supabaseConfigurado, ErrorSupabase } from "./supabase";
export { almacenTurso, tursoConfigurado } from "./turso";

type Env = Record<string, string | undefined>;

export const NOMBRE_ALMACEN: Record<Almacen["tipo"], string> = {
  local: "ficheros locales (data/pendientes)",
  turso: "Turso",
  supabase: "Supabase",
};

/**
 * Almacén en la nube, si hay uno configurado. Turso tiene prioridad: mientras se migra a Supabase
 * (npm run migrar-a-supabase) basta con quitar las variables de Turso para cambiar de almacén.
 */
export function almacenRemoto(env: Env = process.env): Almacen | null {
  if (tursoConfigurado(env)) return almacenTursoDesdeEnv(env);
  if (supabaseConfigurado(env)) return almacenSupabase({ url: env.SUPABASE_URL!, clave: env.SUPABASE_SERVICE_ROLE_KEY! });
  return null;
}

export const remotoConfigurado = (env: Env = process.env) => tursoConfigurado(env) || supabaseConfigurado(env);

/** El almacén en la nube si lo hay; si no, ficheros locales (solo sirve donde se puede escribir en disco) */
export function almacen(env: Env = process.env): Almacen {
  return almacenRemoto(env) ?? almacenLocal();
}

/** En Vercel sin almacén en la nube no hay dónde guardar pendientes (el disco es de solo lectura) */
export function almacenDisponible(env: Env = process.env): boolean {
  return remotoConfigurado(env) || !env.VERCEL;
}
