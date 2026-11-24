/**
 * Extractor: carteles y programas → eventos PENDIENTES de revisión.
 *
 * Uso:
 *   1. Copia en data/entrada/ las imágenes (sirven los nombres de WhatsApp: "00000769-PHOTO-2026-11-19-09-52-44.jpg")
 *      o los programas en PDF (Navidad, fiestas, boletín del SERGAS…).
 *   2. npm run extraer                     (necesita ANTHROPIC_API_KEY en .env.local)
 *      npm run extraer -- --canal email    (canal de origen; por defecto whatsapp para imágenes y programa-pdf para PDF)
 *   3. Revisa los pendientes en /admin (npm run dev) o en data/pendientes/
 *   4. Publica desde /admin o con npm run publicar
 *
 * Un cartel da un evento; un programa da un evento por acto. Los archivos procesados pasan a
 * data/entrada/procesadas/. Un archivo que ya llegó (mismo contenido) no se vuelve a extraer.
 * Con las variables de Turso (o Supabase) en .env.local, los pendientes van a la base de datos.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { almacen, NOMBRE_ALMACEN } from "../src/lib/almacen";
import { buscadorDuplicados } from "../src/lib/duplicados";
import { procesarEntrada } from "../src/lib/entrada";
import { extraer } from "../src/lib/extraccion";
import { fechaHoraGalicia } from "../src/lib/fechas";
import { LISTA_CANALES, type Canal } from "../src/lib/tipos";
import { prepararArchivo } from "../src/lib/recepcion";

const RAIZ = process.cwd();
const ENTRADA = path.join(RAIZ, "data", "entrada");
const PROCESADAS = path.join(ENTRADA, "procesadas");
const EXTENSIONES = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

const args = process.argv.slice(2);
const iCanal = args.indexOf("--canal");
const canalForzado = iCanal >= 0 ? (args[iCanal + 1] as Canal) : undefined;
if (canalForzado && !LISTA_CANALES.includes(canalForzado)) {
  console.log(`Canal no válido. Usa uno de: ${LISTA_CANALES.join(", ")}`);
  process.exit(1);
}

/** "00000769-PHOTO-2026-11-19-09-52-44.jpg" → "2026-11-19T09:52" */
function fechaDeNombre(nombre: string, mtime: Date): string {
  const m = nombre.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  // Sin fecha en el nombre: la de modificación del fichero, en hora de Galicia
  return fechaHoraGalicia(mtime);
}

async function main() {
  const client = new Anthropic();
  const destino = almacen();
  fs.mkdirSync(ENTRADA, { recursive: true });
  const archivos = fs.readdirSync(ENTRADA).filter((f) => EXTENSIONES.includes(path.extname(f).toLowerCase()));
  if (!archivos.length) return console.log("No hay imágenes ni PDF en data/entrada/");
  console.log(`Destino: ${NOMBRE_ALMACEN[destino.tipo]}\n`);

  for (const f of archivos) {
    const ruta = path.join(ENTRADA, f);
    const recibido = fechaDeNombre(f, fs.statSync(ruta).mtime);
    const esPDF = path.extname(f).toLowerCase() === ".pdf";
    process.stdout.write(`→ ${f} … `);
    try {
      const preparado = await prepararArchivo(fs.readFileSync(ruta));
      const r = await procesarEntrada(
        { ...preparado, canal: canalForzado ?? (esPDF ? "programa-pdf" : "whatsapp"), recibido },
        { almacen: destino, extraer: (e) => extraer(e, client), duplicados: await buscadorDuplicados(destino) },
      );
      if (r.estado === "duplicado") console.log("ya extraído antes (mismo archivo): se salta");
      else if (r.estado === "vacio") console.log("no se encontró ningún evento");
      else if (r.estado === "rechazado") {
        console.log(`NO SE PUEDE: ${r.motivo}`);
        continue;
      } else {
        console.log(`${r.eventos.length} ${r.eventos.length === 1 ? "evento" : "eventos"}`);
        for (const e of r.eventos) {
          console.log(`    + ${e.id}: ${e.titulo}`);
          for (const x of e.errores) console.log(`        ✗ ${x}`);
          for (const x of e.avisos) console.log(`        ⚠ ${x}`);
          if (e.duplicados.length) console.log(`        ⚠ posible duplicado de ${e.duplicados.join(", ")}`);
        }
      }
      fs.mkdirSync(PROCESADAS, { recursive: true });
      fs.renameSync(ruta, path.join(PROCESADAS, f));
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        console.log("\nNo hay credenciales válidas: pon ANTHROPIC_API_KEY en .env.local.");
        process.exit(1);
      }
      if (err instanceof Anthropic.APIError) console.log(`ERROR de la API ${err.status}: ${err.message}`);
      else console.log("ERROR", (err as Error).message);
    }
  }
}

main();
