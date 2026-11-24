/**
 * Ejecuta los importadores activos de data/fuentes.json y crea eventos PENDIENTES de revisión.
 *
 *   npm run importar                  → todas las fuentes activas con importador
 *   npm run importar -- cultura-gal   → solo esas
 *   npm run importar -- --simular     → muestra lo que importaría, sin guardar nada
 *
 * Guarda en Supabase si están SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en .env.local);
 * si no, en data/pendientes/. No vuelve a importar lo que ya llegó (aunque se descartara)
 * y marca los posibles duplicados para revisarlos.
 */
import { almacen } from "../src/lib/almacen";
import { detectorDuplicados } from "../src/lib/duplicados";
import { fechaHoraGalicia } from "../src/lib/fechas";
import { guardarFuentes, leerFuentes } from "../src/lib/fuentes";
import { importarFuente } from "../src/lib/importar/ejecutar";
import "../src/lib/importar/pdf"; // registra el importador de boletines en PDF

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const solo = args.filter((a) => !a.startsWith("--"));
const hoy = fechaHoraGalicia().slice(0, 10);

async function main() {
  let fuentes = leerFuentes();
  const elegidas = fuentes.filter((f) => f.importador && (solo.length ? solo.includes(f.id) : f.activa));
  if (!elegidas.length) return console.log(solo.length ? `No hay importador para: ${solo.join(", ")}` : "No hay fuentes activas con importador.");

  const destino = almacen();
  console.log(`Destino: ${destino.tipo === "supabase" ? "Supabase" : "data/pendientes/"}${simular ? " (simulación: no se guarda nada)" : ""}\n`);

  // Un solo detector para toda la importación: también compara entre fuentes
  const detector = await detectorDuplicados(destino);
  let total = 0;
  for (const f of elegidas) {
    process.stdout.write(`→ ${f.nombre} [${f.id}] … `);
    try {
      const r = await importarFuente(f, destino, { simular, hoy, detector });
      total += r.creados.length;
      console.log(`${r.creados.length} nuevos, ${r.yaVistos} ya vistos, ${r.repetidos ?? 0} repetidos, ${r.pasados} pasados${r.nota ? ` · ${r.nota}` : ""}`);
      for (const c of r.creados) console.log(`    + ${c.evento.sesiones[0]?.inicio.slice(0, 10)} ${c.evento.concello}: ${c.evento.titulo}${c.duplicados.length ? `  ⚠ posible duplicado de ${c.duplicados.join(", ")}` : ""}`);
      if (!simular) fuentes = fuentes.map((x) => (x.id === f.id ? { ...x, ultima_revision: hoy } : x));
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`);
    }
  }
  if (!simular) guardarFuentes(fuentes);
  console.log(`\n${total} pendientes nuevos. Revísalos en /admin${destino.tipo === "local" ? " (npm run dev) o en data/pendientes/" : ""}.`);
}

main();
