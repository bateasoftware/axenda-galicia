/**
 * Publica los pendientes revisados de data/pendientes/ (lo mismo que el botón "Publicar" de /admin en local).
 *
 *   npm run publicar                     → publica todos los pendientes válidos
 *   npm run publicar -- slug-1 slug-2    → solo los indicados
 *   npm run publicar -- --forzar slug-1  → sustituye un evento ya publicado con el mismo slug
 *
 * Un pendiente con errores no se publica: se queda en data/pendientes/ con su cartel.
 * Después: git add -A && git commit && git push (Vercel lo publica).
 */
import fs from "node:fs";
import path from "node:path";
import { almacenLocal } from "../src/lib/almacen";
import { validarEvento } from "../src/lib/validacion";

const RAIZ = process.cwd();
const EVENTOS = path.join(RAIZ, "data", "eventos");

const args = process.argv.slice(2);
const forzar = args.includes("--forzar");
const solo = args.filter((a) => !a.startsWith("--"));

async function main() {
  const almacen = almacenLocal(RAIZ);
  const pendientes = (await almacen.pendientes()).filter((p) => !solo.length || solo.includes(p.id));
  if (!pendientes.length) return console.log("Nada que publicar en data/pendientes/");

  let publicados = 0;
  let rechazados = 0;
  for (const p of pendientes) {
    const slug = String(p.evento.slug ?? "");
    const errores: string[] = [];
    if (!forzar && fs.existsSync(path.join(EVENTOS, `${slug}.json`))) errores.push(`ya hay un evento publicado "${slug}" (usa --forzar para sustituirlo)`);
    // Se valida como quedará publicado; el cartel se copia al publicar
    const v = validarEvento({ ...p.evento, ...(p.cartel ? { cartel: `/carteles/${slug}.jpg` } : {}) }, null);
    if (!v.ok) errores.push(...v.errores);
    if (errores.length || !v.ok) {
      console.log(`✗ ${p.id} no se publica:\n${errores.map((e) => `    - ${e}`).join("\n")}`);
      rechazados++;
      continue;
    }
    // Si el pendiente trae cartel, lo copia y pone la ruta el almacén
    await almacen.publicar(p.id, { ...v.valor, cartel: p.cartel ? undefined : v.valor.cartel });
    console.log(`✓ publicado ${slug}`);
    for (const a of v.avisos) console.log(`    ⚠ ${a}`);
    if (p.contacto) console.log(`    ✉ avisa a quien lo envió (${p.contacto.canal}); el contacto está en data/pendientes/.privado/`);
    publicados++;
  }
  console.log(`\n${publicados} publicados, ${rechazados} pendientes de corregir`);
  process.exit(rechazados ? 1 : 0);
}

main();
