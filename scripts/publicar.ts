/**
 * Publica los eventos revisados: data/pendientes/*.json → data/eventos/
 * y copia su cartel de data/entrada/ a public/carteles/.
 *
 *   npm run publicar            → publica todos los pendientes
 *   npm run publicar -- slug-1  → solo los indicados
 */
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const PEND = path.join(RAIZ, "data", "pendientes");
const EVENTOS = path.join(RAIZ, "data", "eventos");
const ENTRADA = path.join(RAIZ, "data", "entrada");
const CARTELES = path.join(RAIZ, "public", "carteles");

const solo = process.argv.slice(2);
const ficheros = fs.readdirSync(PEND).filter((f) => f.endsWith(".json") && (!solo.length || solo.includes(f.replace(".json", ""))));

for (const f of ficheros) {
  const ev = JSON.parse(fs.readFileSync(path.join(PEND, f), "utf8"));
  if (ev._imagen) {
    const ext = path.extname(ev._imagen).toLowerCase();
    const destino = `${ev.slug}${ext}`;
    fs.copyFileSync(path.join(ENTRADA, ev._imagen), path.join(CARTELES, destino));
    fs.rmSync(path.join(ENTRADA, ev._imagen));
    ev.cartel = `/carteles/${destino}`;
    delete ev._imagen;
  }
  fs.writeFileSync(path.join(EVENTOS, f), JSON.stringify(ev, null, 2));
  fs.rmSync(path.join(PEND, f));
  console.log(`✓ publicado ${ev.slug}`);
}
if (!ficheros.length) console.log("Nada que publicar en data/pendientes/");
