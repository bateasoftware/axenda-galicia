/**
 * Fuentes que toca revisar hoy según su frecuencia (data/fuentes.json).
 *
 *   npm run revisar-fuentes                       → lista las que tocan (manuales y automáticas)
 *   npm run revisar-fuentes -- --todas            → lista todas con su próxima revisión
 *   npm run revisar-fuentes -- --marcar id1 id2   → las marca como revisadas hoy
 *
 * Las automáticas (ics, api, pdf) las marca solas `npm run importar` al importarlas.
 */
import { fechaHoraGalicia } from "../src/lib/fechas";
import { fuentesPorRevisar, guardarFuentes, leerFuentes, proximaRevision } from "../src/lib/fuentes";

const args = process.argv.slice(2);
const hoy = fechaHoraGalicia().slice(0, 10);
const fuentes = leerFuentes();

if (args.includes("--marcar")) {
  const ids = args.filter((a) => !a.startsWith("--"));
  const desconocidas = ids.filter((id) => !fuentes.some((f) => f.id === id));
  if (!ids.length || desconocidas.length) {
    console.log(desconocidas.length ? `No existen: ${desconocidas.join(", ")}` : "Indica los id de las fuentes revisadas.");
    process.exit(1);
  }
  guardarFuentes(fuentes.map((f) => (ids.includes(f.id) ? { ...f, ultima_revision: hoy } : f)));
  console.log(`✓ Marcadas como revisadas hoy (${hoy}): ${ids.join(", ")}`);
  process.exit(0);
}

if (args.includes("--todas")) {
  for (const f of fuentes)
    console.log(`${f.id.padEnd(30)} ${f.metodo.padEnd(16)} ${f.frecuencia.padEnd(10)} próxima: ${proximaRevision(f) ?? "ya"}${f.estado === "sin verificar" ? "  (sin verificar)" : ""}`);
  process.exit(0);
}

const tocan = fuentesPorRevisar(fuentes, hoy);
if (!tocan.length) {
  console.log("Hoy no toca revisar ninguna fuente. 🎉");
  process.exit(0);
}
console.log(`Fuentes por revisar hoy (${hoy}):\n`);
for (const f of tocan) {
  const cuando = f.retraso === null ? "nunca revisada" : f.retraso === 0 ? "toca hoy" : `${f.retraso} días de retraso`;
  const auto = f.importador && f.activa ? " · automática: npm run importar" : "";
  console.log(`• ${f.nombre} [${f.id}] (${cuando}${auto})`);
  console.log(`  ${f.url}`);
  if (f.estado === "sin verificar") console.log("  ⚠ sin verificar: comprueba la URL y actualiza data/fuentes.json");
  if (f.tipo === "prensa" || f.tipo === "agregador") console.log("  Solo alerta: no copies el texto, busca la fuente original.");
  if (f.tipo === "redes") console.log("  Solo revisión manual: nada de extracción automática.");
}
console.log(`\nAl terminar: npm run revisar-fuentes -- --marcar ${tocan.map((f) => f.id).slice(0, 3).join(" ")} …`);
