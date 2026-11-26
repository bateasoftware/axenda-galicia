/**
 * Comprueba los datos antes de publicar o desplegar.
 *
 *   npm run validar   → data/eventos, data/pendientes, data/lugares.json y data/fuentes.json
 *
 * Sale con código 1 si algo de data/eventos o lugares.json no es válido
 * (los pendientes solo se informan: todavía están en revisión).
 */
import path from "node:path";
import { ReglasSchema } from "../src/lib/admin/reglas";
import { LISTA_CANALES } from "../src/lib/tipos";
import { leerFuentes } from "../src/lib/fuentes";
import reglasJSON from "../data/reglas.json";
import { formatearProblemas, leerEventos, validarLugares } from "../src/lib/validacion";

const RAIZ = process.cwd();
let fallos = 0;

const lugares = validarLugares(RAIZ);
if (lugares.length) {
  fallos++;
  console.log(`✗ data/lugares.json\n${lugares.map((e) => `    - ${e}`).join("\n")}`);
} else console.log("✓ data/lugares.json");

try {
  const fuentes = leerFuentes();
  const sinVerificar = fuentes.filter((f) => f.estado === "sin verificar").length;
  console.log(`✓ data/fuentes.json (${fuentes.length} fuentes, ${sinVerificar} sin verificar)`);
} catch (err) {
  fallos++;
  console.log(`✗ data/fuentes.json\n    - ${(err as Error).message.replaceAll("\n", "\n    ")}`);
}

try {
  const reglas = ReglasSchema.parse(reglasJSON).autopublicar;
  const ids = new Set<string>([...LISTA_CANALES, ...leerFuentes().map((f) => f.id)]);
  const raras = reglas.filter((r) => !ids.has(r.emisor));
  if (raras.length) throw new Error(`emisor desconocido: ${raras.map((r) => r.emisor).join(", ")}`);
  console.log(`✓ data/reglas.json (${reglas.length} reglas de publicación rápida)`);
} catch (err) {
  fallos++;
  console.log(`✗ data/reglas.json\n    - ${(err as Error).message.replaceAll("\n", "\n    ")}`);
}

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
