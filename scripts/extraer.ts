/**
 * Extractor de carteles → JSON de evento.
 *
 * Uso:
 *   1. Copia las imágenes en data/entrada/ (sirven los nombres de WhatsApp: "00000769-PHOTO-2026-11-19-09-52-44.jpg")
 *   2. ANTHROPIC_API_KEY=... npm run extraer
 *   3. Revisa los JSON de data/pendientes/ (mira "inferido", "confianza" y los avisos que imprime)
 *   4. npm run publicar   → valida, mueve los revisados a data/eventos/ y el cartel a public/carteles/
 *
 * Las imágenes que ya tienen un pendiente se saltan; para repetir una, borra su JSON de data/pendientes/.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { extraerCartel, type TipoImagen } from "../src/lib/extraccion";
import { fechaHoraGalicia } from "../src/lib/fechas";
import { validarEvento } from "../src/lib/validacion";

const RAIZ = process.cwd();
const ENTRADA = path.join(RAIZ, "data", "entrada");
const PENDIENTES = path.join(RAIZ, "data", "pendientes");
const EVENTOS = path.join(RAIZ, "data", "eventos");

const TIPOS: Record<string, TipoImagen> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** "00000769-PHOTO-2026-11-19-09-52-44.jpg" → "2026-11-19T09:52" */
function fechaDeNombre(nombre: string, mtime: Date): string {
  const m = nombre.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  // Sin fecha en el nombre: la de modificación del fichero, en hora de Galicia
  return fechaHoraGalicia(mtime);
}

/** Imágenes que ya tienen un JSON en pendientes (por el campo interno "_imagen") */
function imagenesYaExtraidas(): Set<string> {
  const usadas = new Set<string>();
  for (const f of fs.readdirSync(PENDIENTES).filter((x) => x.endsWith(".json"))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(PENDIENTES, f), "utf8"));
      if (j._imagen) usadas.add(j._imagen);
    } catch {
      // un pendiente roto no debe parar la extracción
    }
  }
  return usadas;
}

/** Devuelve un slug libre: si ya existe en pendientes o eventos, añade -2, -3… */
function slugLibre(slug: string): string {
  const existe = (s: string) =>
    fs.existsSync(path.join(PENDIENTES, `${s}.json`)) || fs.existsSync(path.join(EVENTOS, `${s}.json`));
  if (!existe(slug)) return slug;
  let n = 2;
  while (existe(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

async function main() {
  const client = new Anthropic();
  const yaExtraidas = imagenesYaExtraidas();
  const imagenes = fs.readdirSync(ENTRADA).filter((f) => path.extname(f).toLowerCase() in TIPOS);
  const nuevas = imagenes.filter((f) => !yaExtraidas.has(f));
  if (imagenes.length > nuevas.length) console.log(`(${imagenes.length - nuevas.length} imágenes ya tienen pendiente; se saltan)`);
  if (!nuevas.length) return console.log("No hay imágenes nuevas en data/entrada/");

  for (const f of nuevas) {
    const ruta = path.join(ENTRADA, f);
    const recibido = fechaDeNombre(f, fs.statSync(ruta).mtime);
    process.stdout.write(`→ ${f} … `);
    try {
      const r = await extraerCartel(
        { imagen: fs.readFileSync(ruta), tipo: TIPOS[path.extname(f).toLowerCase()], recibido },
        client,
      );
      if (r.tipo === "rechazado") {
        console.log(`RECHAZADO (${r.categoria ?? "sin categoría"})`);
        continue;
      }
      if (r.tipo === "incompleto") {
        console.log(`ERROR: respuesta incompleta (${r.motivo})`);
        continue;
      }

      const ev = { ...r.evento, slug: slugLibre(r.evento.slug), fuente: { canal: "whatsapp" as const, recibido } };
      // Se guarda aunque tenga errores: se corrige a mano en la revisión, y publicar no deja pasar nada inválido
      fs.writeFileSync(path.join(PENDIENTES, `${ev.slug}.json`), JSON.stringify({ ...ev, _imagen: f }, null, 2) + "\n");

      const v = validarEvento(ev, RAIZ, `${ev.slug}.json`);
      console.log(`ok → pendientes/${ev.slug}.json (${ev.titulo}, confianza ${ev.confianza})`);
      if (!v.ok) for (const e of v.errores) console.log(`    ✗ ${e}`);
      for (const a of v.avisos) console.log(`    ⚠ ${a}`);
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
