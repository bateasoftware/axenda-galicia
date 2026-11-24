/**
 * Publica los eventos revisados: data/pendientes/*.json → data/eventos/
 * y copia su cartel de data/entrada/ a public/carteles/.
 *
 *   npm run publicar                     → publica todos los pendientes válidos
 *   npm run publicar -- slug-1 slug-2    → solo los indicados
 *   npm run publicar -- --forzar slug-1  → sustituye un evento ya publicado con el mismo slug
 *
 * Un pendiente con errores no se publica: se queda en data/pendientes/ con su imagen.
 */
import fs from "node:fs";
import path from "node:path";
import { sinCamposInternos, validarEvento } from "../src/lib/validacion";

const RAIZ = process.cwd();
const PEND = path.join(RAIZ, "data", "pendientes");
const EVENTOS = path.join(RAIZ, "data", "eventos");
const ENTRADA = path.join(RAIZ, "data", "entrada");
const CARTELES = path.join(RAIZ, "public", "carteles");

const args = process.argv.slice(2);
const forzar = args.includes("--forzar");
const solo = args.filter((a) => !a.startsWith("--"));
const ficheros = fs
  .readdirSync(PEND)
  .filter((f) => f.endsWith(".json") && (!solo.length || solo.includes(f.replace(/\.json$/, ""))));

let publicados = 0;
let rechazados = 0;

for (const f of ficheros) {
  let crudo: Record<string, unknown>;
  try {
    crudo = JSON.parse(fs.readFileSync(path.join(PEND, f), "utf8"));
  } catch (err) {
    console.log(`✗ ${f}: JSON mal formado (${(err as Error).message})`);
    rechazados++;
    continue;
  }

  const imagen = typeof crudo._imagen === "string" ? crudo._imagen : undefined;
  const ev = sinCamposInternos(crudo) as Record<string, unknown>;
  const slug = String(ev.slug ?? "");
  const origen = imagen && path.join(ENTRADA, imagen);
  const nombreCartel = imagen && `${slug}${path.extname(imagen).toLowerCase()}`;

  const errores: string[] = [];
  if (origen && !fs.existsSync(origen)) errores.push(`no está la imagen data/entrada/${imagen}`);
  if (!forzar && fs.existsSync(path.join(EVENTOS, `${slug}.json`))) errores.push(`ya hay un evento publicado "${slug}" (usa --forzar para sustituirlo)`);
  if (nombreCartel) ev.cartel = `/carteles/${nombreCartel}`;

  // Se valida como quedará publicado. El cartel aún no está copiado, así que se comprueba aparte.
  const v = validarEvento(ev, RAIZ, f);
  if (!v.ok) errores.push(...v.errores.filter((e) => !(nombreCartel && e.startsWith("cartel: no existe"))));

  if (errores.length) {
    console.log(`✗ ${f} no se publica:\n${errores.map((e) => `    - ${e}`).join("\n")}`);
    rechazados++;
    continue;
  }

  // Primero se escribe todo; solo al final se borra lo de entrada y pendientes
  if (origen && nombreCartel) fs.copyFileSync(origen, path.join(CARTELES, nombreCartel));
  fs.writeFileSync(path.join(EVENTOS, f), JSON.stringify(ev, null, 2) + "\n");
  fs.rmSync(path.join(PEND, f));
  if (origen) fs.rmSync(origen);

  console.log(`✓ publicado ${slug}`);
  for (const a of v.avisos) console.log(`    ⚠ ${a}`);
  publicados++;
}

if (!ficheros.length) console.log("Nada que publicar en data/pendientes/");
else console.log(`\n${publicados} publicados, ${rechazados} pendientes de corregir`);
process.exit(rechazados ? 1 : 0);
