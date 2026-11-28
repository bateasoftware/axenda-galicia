/**
 * Descarta los pendientes cuya fecha ya pasó. Los descartados no vuelven a entrar al importar.
 *
 *   npm run descartar-pasados             → descarta
 *   npm run descartar-pasados -- --simular → solo los lista
 */
import { almacen, NOMBRE_ALMACEN } from "../src/lib/almacen";
import { esPasado } from "../src/lib/admin/cola";
import { fechaHoraGalicia } from "../src/lib/fechas";

const simular = process.argv.includes("--simular");

async function main() {
  const a = almacen();
  const ahora = fechaHoraGalicia();
  const pasados = (await a.pendientes()).filter((p) => esPasado(p, ahora));
  console.log(`Destino: ${NOMBRE_ALMACEN[a.tipo]}. ${pasados.length} pendientes ya pasados${simular ? " (simulación)" : ""}.`);
  for (const p of pasados) {
    console.log(`  ${p.evento.sesiones[0]?.inicio ?? "?"}  ${p.evento.titulo}`);
    if (!simular) await a.descartar(p.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
