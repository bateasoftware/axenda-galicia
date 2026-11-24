/**
 * Sube los pendientes de data/pendientes/ (los de `npm run extraer` o los que prepara Claude Code)
 * a la base de datos (Turso o Supabase), con su cartel, para revisarlos en /admin desde cualquier sitio.
 *
 *   npm run subir-pendientes              → sube todos y los borra de data/pendientes
 *   npm run subir-pendientes -- --simular → solo dice qué subiría
 *
 * No sube los que ya estén (mismo cartel o misma fuente) y marca los posibles duplicados.
 */
import fs from "node:fs";
import path from "node:path";
import { almacenLocal, almacenRemoto } from "../src/lib/almacen";
import { buscadorDuplicados } from "../src/lib/duplicados";
import { prepararArchivo } from "../src/lib/recepcion";

const RAIZ = process.cwd();
const simular = process.argv.includes("--simular");

/** Ya está en la base de datos: fuera de data/pendientes (sin apuntarlo como descartado) */
function quitar(id: string, crudo: Record<string, unknown>, rutaCartel: string | null) {
  fs.rmSync(path.join(RAIZ, "data", "pendientes", `${id}.json`));
  if (rutaCartel && typeof crudo._cartel === "string") fs.rmSync(rutaCartel, { force: true });
}

async function main() {
  const remoto = almacenRemoto();
  if (!remoto) return console.log("No hay base de datos configurada: pon TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env.local.");
  const local = almacenLocal(RAIZ);
  const pendientes = await local.pendientes();
  if (!pendientes.length) return console.log("No hay nada en data/pendientes/.");
  const duplicados = await buscadorDuplicados(remoto);
  let subidos = 0;

  for (const p of pendientes) {
    const crudo = JSON.parse(fs.readFileSync(path.join(RAIZ, "data", "pendientes", `${p.id}.json`), "utf8"));
    const rutaCartel =
      typeof crudo._cartel === "string" ? path.join(RAIZ, crudo._cartel) : typeof crudo._imagen === "string" ? path.join(RAIZ, "data", "entrada", crudo._imagen) : null;
    const preparado = rutaCartel && fs.existsSync(rutaCartel) ? await prepararArchivo(fs.readFileSync(rutaCartel)) : undefined;
    const hash = p.hash ?? preparado?.hash;
    const f = p.evento.fuente;
    if ((hash && (await remoto.yaVisto({ hash }))) || (f.id_fuente && f.uid && (await remoto.yaVisto({ id_fuente: f.id_fuente, uid: f.uid })))) {
      console.log(`= ${p.id}: ya estaba en la base de datos (se quita de data/pendientes)`);
      if (!simular) quitar(p.id, crudo, rutaCartel);
      continue;
    }
    const dups = duplicados(p.evento);
    console.log(`↑ ${p.id}: ${p.evento.titulo}${dups.length ? `  ⚠ posible duplicado de ${dups.join(", ")}` : ""}`);
    if (simular) continue;
    await remoto.crear({
      evento: p.evento,
      cartel: preparado?.archivo.tipo === "image/jpeg" ? { datos: preparado.archivo.datos, tipo: "image/jpeg" } : undefined,
      hash,
      contacto: p.contacto,
      duplicados: dups,
    });
    quitar(p.id, crudo, rutaCartel);
    await local.olvidarContacto(p.id);
    subidos++;
  }
  console.log(simular ? "\nSimulación: no se ha subido nada." : `\n✓ ${subidos} subidos. Revísalos en /admin.`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
