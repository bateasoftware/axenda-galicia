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
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import fs from "node:fs";
import path from "node:path";
import { EventoBase } from "../src/lib/tipos";
import { validarEvento } from "../src/lib/validacion";

const RAIZ = process.cwd();
const ENTRADA = path.join(RAIZ, "data", "entrada");
const PENDIENTES = path.join(RAIZ, "data", "pendientes");
const EVENTOS = path.join(RAIZ, "data", "eventos");
const LUGARES = JSON.parse(fs.readFileSync(path.join(RAIZ, "data", "lugares.json"), "utf8"));
const MODELO = process.env.MODELO_EXTRACCION ?? "claude-sonnet-5-5";

const TIPOS = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" } as const;
type Ext = keyof typeof TIPOS;

// Lo que devuelve el modelo: el evento sin los campos que pone el script (fuente y cartel)
const Extraccion = EventoBase.omit({ fuente: true, cartel: true });

/** "00000769-PHOTO-2026-11-19-09-52-44.jpg" → "2026-11-19T09:52" */
function fechaDeNombre(nombre: string, mtime: Date): string {
  const m = nombre.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  // Sin fecha en el nombre: la de modificación del fichero, en hora de Galicia
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })
    .format(mtime)
    .replace(" ", "T");
}

function prompt(recibido: string) {
  return `Eres el editor de una agenda de eventos de Galicia (Val Miñor y Vigo). Extrae los datos de este cartel.

Mensaje recibido el ${recibido} (hora de Galicia). Si el cartel no indica el año, usa el de la próxima fecha posterior o igual a la de recepción.

Reglas:
- Fechas y horas como "YYYY-MM-DDTHH:MM" en 24 h. Si pone "8:30" como cierre tras abrir a las 10:30, es 20:30. Anótalo en "inferido".
- Si hay programa por horas, una sesión por acto con "nota". Si son varios días con horarios distintos, una sesión por día.
- "slug": kebab-case corto, sin tildes, con lugar y año (p. ej. "magosto-panxon-2026").
- "titulo" en castellano; "titulo_gl" con el original si el cartel está en gallego.
- "resumen": 1-2 frases propias, sin copiar literalmente el cartel.
- El concello puede deducirse del escudo o logo; indícalo en "inferido".
- Coordenadas: usa la tabla de lugares conocidos si coincide; si no, el centro de la parroquia o del concello y "aprox": true.
- "comercial": true si es la promoción de un negocio.
- "recurrente": true si indica edición (XVI…) o "un año más".
- No inventes precio, organizador ni datos de contacto. Lo que no esté, omítelo.
- "confianza" entre 0 y 1.

Lugares conocidos:
${JSON.stringify(LUGARES)}`;
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
      const res = await client.beta.messages.parse({
        model: MODELO,
        max_tokens: 16000,
        // Si el modelo rechaza la petición, la API la reintenta con otro modelo adecuado
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { format: betaZodOutputFormat(Extraccion) },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: TIPOS[path.extname(f).toLowerCase() as Ext],
                  data: fs.readFileSync(ruta).toString("base64"),
                },
              },
              { type: "text", text: prompt(recibido) },
            ],
          },
        ],
      });

      if (res.stop_reason === "refusal") {
        console.log(`RECHAZADO (${res.stop_details?.category ?? "sin categoría"})`);
        continue;
      }
      if (res.stop_reason === "max_tokens" || !res.parsed_output) {
        console.log(`ERROR: respuesta incompleta (${res.stop_reason})`);
        continue;
      }

      const ev = { ...res.parsed_output, slug: slugLibre(res.parsed_output.slug), fuente: { canal: "whatsapp" as const, recibido } };
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
