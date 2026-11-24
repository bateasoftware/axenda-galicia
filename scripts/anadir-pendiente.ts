/**
 * Añade eventos como PENDIENTES (nunca publicados) a partir de un JSON mínimo.
 * Lo usa la sesión de procesado de envíos (Claude Code) y sirve también para cargar eventos a mano.
 *
 *   npm run anadir-pendiente -- eventos.json [--imagen cartel.jpg] [--canal whatsapp] [--recibido 2026-11-24T10:00] [--url https://…] [--simular]
 *
 *   eventos.json   un evento o una lista (ver docs/procesar-envios.md para el formato)
 *   --imagen       cartel (se reduce y se le quitan los metadatos); el mismo para todos los eventos del archivo
 *   --canal        whatsapp (por defecto) | manual (enlaces, texto) | email | formulario | programa-pdf
 *   --recibido     cuándo llegó (por defecto, ahora)
 *   --url          enlace de donde sale el evento (se muestra en el panel como fuente)
 *
 * Guarda en la base de datos (Turso o Supabase) si hay variables en .env.local; si no, en data/pendientes/.
 * No vuelve a añadir el mismo cartel y marca los posibles duplicados. Sale con error si algún evento no es válido.
 */
import fs from "node:fs";
import { almacen, NOMBRE_ALMACEN } from "../src/lib/almacen";
import { CANALES_VALIDOS, construirBorrador } from "../src/lib/anadir";
import { buscadorDuplicados } from "../src/lib/duplicados";
import { fechaHoraGalicia } from "../src/lib/fechas";
import { normalizarCartel } from "../src/lib/imagen";
import type { Canal } from "../src/lib/tipos";

const args = process.argv.slice(2);
const opcion = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const CON_VALOR = ["--imagen", "--canal", "--recibido", "--url"];
const archivo = args.find((a, i) => !a.startsWith("--") && !CON_VALOR.includes(args[i - 1]));
const simular = args.includes("--simular");

async function main() {
  const canal = (opcion("--canal") ?? "whatsapp") as Canal;
  if (!CANALES_VALIDOS.includes(canal)) throw new Error(`Canal no válido: ${canal}. Usa uno de: ${CANALES_VALIDOS.join(", ")}`);
  if (!archivo || !fs.existsSync(archivo)) throw new Error("Indica el archivo JSON con el evento (o la lista de eventos).");
  const recibido = opcion("--recibido") ?? fechaHoraGalicia();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(recibido)) throw new Error('--recibido debe ser "YYYY-MM-DDTHH:MM"');

  const bruto = JSON.parse(fs.readFileSync(archivo, "utf8"));
  const lista: unknown[] = Array.isArray(bruto) ? bruto : [bruto];
  const construidos = lista.map((x) => construirBorrador(x, { canal, recibido, url: opcion("--url") }));
  const conErrores = construidos.filter((c) => c.errores.length);
  if (conErrores.length) {
    construidos.forEach((c, i) => c.errores.forEach((e) => console.log(`✗ evento ${i + 1}: ${e}`)));
    throw new Error("Corrige los errores y vuelve a ejecutarlo (no se ha guardado nada).");
  }

  let cartel: { datos: Buffer; tipo: "image/jpeg" } | undefined;
  let hash: string | undefined;
  const rutaImagen = opcion("--imagen");
  if (rutaImagen) {
    const n = await normalizarCartel(fs.readFileSync(rutaImagen));
    cartel = { datos: n.imagen, tipo: "image/jpeg" };
    hash = n.hash;
  }

  const destino = almacen();
  console.log(`Destino: ${NOMBRE_ALMACEN[destino.tipo]}${simular ? " (simulación: no se guarda nada)" : ""}`);
  if (hash && (await destino.yaVisto({ hash }))) return console.log("= Este cartel ya estaba (mismo archivo): no se añade otra vez.");

  const duplicados = await buscadorDuplicados(destino);
  for (const [i, c] of construidos.entries()) {
    const e = c.evento!;
    const dups = duplicados(e);
    console.log(`+ ${e.titulo} · ${e.sesiones[0].inicio} · ${e.concello}${dups.length ? `\n    ⚠ posible duplicado de ${dups.join(", ")}` : ""}`);
    for (const a of c.avisos) console.log(`    ⚠ ${a}`);
    if (simular) continue;
    // El hash solo en el primero: basta para reconocer el cartel; todos comparten la imagen
    await destino.crear({ evento: e, cartel, hash: i === 0 ? hash : undefined, duplicados: dups });
  }
  console.log(simular ? "\nSimulación: no se ha guardado nada." : `\n✓ ${construidos.length} pendientes guardados. Se revisan en /admin.`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
