/**
 * Copia todo de Turso a Supabase: eventos (pendientes, publicados y descartados) y contactos.
 *
 *   1. Crea el proyecto de Supabase y ejecuta supabase/esquema.sql en su SQL Editor.
 *   2. En .env.local deja a la vez las variables de Turso y las de Supabase.
 *   3. npm run migrar-a-supabase                → lo copia (se puede repetir: no duplica)
 *      npm run migrar-a-supabase -- --simular   → solo cuenta lo que copiaría
 *   4. Comprueba en /admin y quita las variables de Turso (en Vercel y en .env.local): desde ahí se usa Supabase.
 *
 * Los carteles se quedan en Vercel Blob (mantén BLOB_READ_WRITE_TOKEN o, al menos, el almacén de Blob).
 */
import { almacenTurso, tursoConfigurado } from "../src/lib/almacen";
import { importarEnSupabase, supabaseConfigurado } from "../src/lib/almacen/supabase";
import { clienteTurso, subirCartelBlob } from "../src/lib/almacen/turso";

async function main() {
  if (!tursoConfigurado()) return console.log("Faltan TURSO_DATABASE_URL y BLOB_READ_WRITE_TOKEN en .env.local.");
  if (!supabaseConfigurado()) return console.log("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  const turso = almacenTurso({ cliente: () => clienteTurso(), subirCartel: subirCartelBlob(process.env.BLOB_READ_WRITE_TOKEN!) });
  const { eventos, contactos } = await turso.exportar();
  const cuenta = (e: string) => eventos.filter((x) => x.estado === e).length;
  console.log(`Turso: ${eventos.length} eventos (${cuenta("publicado")} publicados, ${cuenta("pendiente")} pendientes, ${cuenta("descartado")} descartados) y ${contactos.length} contactos.`);
  if (process.argv.includes("--simular")) return console.log("Simulación: no se ha copiado nada.");
  await importarEnSupabase({ url: process.env.SUPABASE_URL!, clave: process.env.SUPABASE_SERVICE_ROLE_KEY! }, eventos, contactos);
  console.log("✓ Copiado a Supabase. Revisa /admin y, si está bien, quita las variables de Turso para pasar a usar Supabase.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
