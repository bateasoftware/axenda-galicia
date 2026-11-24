/**
 * Comprueba los datos antes de publicar o desplegar.
 *
 *   npm run validar   → data/eventos, data/pendientes y data/lugares.json
 *
 * Sale con código 1 si algo de data/eventos o lugares.json no es válido
 * (los pendientes solo se informan: todavía están en revisión).
 */
import path from "node:path";
import { formatearProblemas, leerEventos, validarLugares } from "../src/lib/validacion";

const RAIZ = process.cwd();
let fallos = 0;

const lugares = validarLugares(RAIZ);
if (lugares.length) {
  fallos++;
  console.log(`✗ data/lugares.json\n${lugares.map((e) => `    - ${e}`).join("\n")}`);
} else console.log("✓ data/lugares.json");

for (const carpeta of ["eventos", "pendientes"] as const) {
  const { eventos, problemas, avisos } = leerEventos(path.join(RAIZ, "data", carpeta), RAIZ, {
    pendientes: carpeta === "pendientes",
  });
  console.log(`\ndata/${carpeta}: ${eventos.length} válidos, ${problemas.length} con errores`);
  if (problemas.length) {
    console.log(formatearProblemas(problemas));
    if (carpeta === "eventos") fallos++;
  }
  for (const a of avisos) console.log(`  ⚠ ${a.fichero}: ${a.avisos.join(" · ")}`);
}

process.exit(fallos ? 1 : 0);
