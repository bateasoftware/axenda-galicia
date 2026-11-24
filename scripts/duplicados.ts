/**
 * Busca posibles duplicados entre los pendientes y lo publicado (mismo día, mismo concello, título parecido).
 *
 *   npm run duplicados             → lista
 *   npm run duplicados -- --marcar → además los marca en cada pendiente para verlos en /admin
 *
 * Los nuevos se marcan solos al llegar; esto sirve para repasar los que ya había.
 */
import { almacen } from "../src/lib/almacen";
import { duplicadosEntrePendientes } from "../src/lib/duplicados";

async function main() {
  const a = almacen();
  const lista = await duplicadosEntrePendientes(a);
  if (!lista.length) return console.log("No hay posibles duplicados entre los pendientes.");
  for (const d of lista) {
    console.log(`• ${d.titulo} [${d.id}]`);
    for (const c of d.coincidencias) console.log(`    ~ ${c.ref} (parecido ${Math.round(c.parecido * 100)} %)`);
  }
  if (process.argv.includes("--marcar")) {
    for (const d of lista) await a.marcarDuplicados(d.id, d.coincidencias.map((c) => c.ref));
    console.log(`\n✓ Marcados ${lista.length} pendientes.`);
  } else console.log("\nPara marcarlos y verlos en /admin: npm run duplicados -- --marcar");
}

main();
