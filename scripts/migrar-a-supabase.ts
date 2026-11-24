/**
 * Copia todo de Turso a Supabase: eventos (pendientes, publicados y descartados) y contactos.
 *
 *   1. Crea el proyecto de Supabase y ejecuta supabase/esquema.sql en su SQL Editor.
 *   2. En .env.local deja a la vez las variables de Turso y las de Supabase.
 *   3. npm run migrar-a-supabase                → lo copia (se puede repetir: no duplica)
 *      npm run migrar-a-supabase -- --simular   → solo cuenta lo que copiaría
 *   4. Comprueba en /admin y quita las variables de Turso (en Vercel y en .env.local): desde ahí se usa Supabase.
 *
 * Los carteles guardados en Turso se suben al bucket "carteles" de Supabase; los de Vercel Blob se quedan donde están.
 */
import { almacenTursoDesdeEnv, tursoConfigurado } from "../src/lib/almacen";
import { importarEnSupabase, supabaseConfigurado } from "../src/lib/almacen/supabase";

async function main() {
  if (!tursoConfigurado()) return console.log("Falta TURSO_DATABASE_URL (y TURSO_AUTH_TOKEN) en .env.local.");
  if (!supabaseConfigurado()) return console.log("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  const turso = almacenTursoDesdeEnv();
  const { eventos, contactos } = await turso.exportar();
  const cuenta = (e: string) => eventos.filter((x) => x.estado === e).length;
  console.log(`Turso: ${eventos.length} eventos (${cuenta("publicado")} publicados, ${cuenta("pendiente")} pendientes, ${cuenta("descartado")} descartados) y ${contactos.length} contactos.`);
  if (process.argv.includes("--simular")) return console.log("Simulación: no se ha copiado nada.");
  const destino = { url: process.env.SUPABASE_URL!, clave: process.env.SUPABASE_SERVICE_ROLE_KEY! };
  await importarEnSupabase(destino, eventos, contactos, (id) => turso.cartel(id));
  console.log("✓ Copiado a Supabase. Revisa /admin y, si está bien, quita las variables de Turso para pasar a usar Supabase.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
