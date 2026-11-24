import { almacenLocal } from "./local";
import { almacenSupabase, supabaseConfigurado } from "./supabase";
import type { Almacen } from "./tipos";

export * from "./tipos";
export { almacenLocal, limpiarSlug, slugLibre } from "./local";
export { almacenSupabase, supabaseConfigurado, ErrorSupabase } from "./supabase";

/** Supabase si están sus variables; si no, ficheros locales (solo sirve donde se puede escribir en disco). */
export function almacen(env: Record<string, string | undefined> = process.env): Almacen {
  if (supabaseConfigurado(env)) return almacenSupabase({ url: env.SUPABASE_URL!, clave: env.SUPABASE_SERVICE_ROLE_KEY! });
  return almacenLocal();
}

/** En Vercel sin Supabase no hay dónde guardar pendientes (el disco es de solo lectura) */
export function almacenDisponible(env: Record<string, string | undefined> = process.env): boolean {
  return supabaseConfigurado(env) || !env.VERCEL;
}
