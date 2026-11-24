/**
 * Extractor de carteles → JSON de evento.
 *
 * Uso:
 *   1. Copia las imágenes en data/entrada/ (sirven los nombres de WhatsApp: "00000769-PHOTO-2026-11-19-09-52-44.jpg")
 *   2. ANTHROPIC_API_KEY=... npm run extraer
 *   3. Revisa los JSON de data/pendientes/ (mira "inferido" y "confianza")
 *   4. npm run publicar   → mueve los revisados a data/eventos/ y el cartel a public/carteles/
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const ENTRADA = path.join(RAIZ, "data", "entrada");
const PENDIENTES = path.join(RAIZ, "data", "pendientes");
const LUGARES = JSON.parse(fs.readFileSync(path.join(RAIZ, "data", "lugares.json"), "utf8"));
const MODELO = process.env.MODELO_EXTRACCION ?? "claude-sonnet-5-5";

const TIPOS: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** "00000769-PHOTO-2026-11-19-09-52-44.jpg" → "2026-11-19T09:52" */
function fechaDeNombre(nombre: string, mtime: Date): string {
  const m = nombre.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  return mtime.toISOString().slice(0, 16);
}

const ESQUEMA = `{
  "slug": "kebab-case-corto-con-lugar-y-año",
  "titulo": "Título claro en castellano",
  "titulo_gl": "Título en gallego (si el cartel está en gallego, el original)",
  "resumen": "1-2 frases propias, sin copiar literalmente el cartel",
  "sesiones": [{ "inicio": "YYYY-MM-DDTHH:MM", "fin": "YYYY-MM-DDTHH:MM (opcional)", "nota": "qué pasa (opcional)" }],
  "lugares": [{ "nombre": "", "direccion": "(opcional)", "lat": 0, "lng": 0, "aprox": true }],
  "concello": "Baiona | Nigrán | Gondomar | Vigo | ...",
  "parroquia": "(opcional)",
  "organizadores": [""],
  "categorias": ["navidad|fiestas|musica|cine|teatro|infantil|deporte|solidario|mercadillo|gastronomia|cultura|comercial"],
  "publico": "(opcional)",
  "precio": "(opcional; omitir si no aparece)",
  "inscripcion": { "url": "", "telefono": "", "email": "", "hasta": "YYYY-MM-DD" },
  "extras": ["(opcional)"],
  "idioma": "gl | es | mixto",
  "inferido": ["lista de campos deducidos y no leídos literalmente"],
  "confianza": 0.0,
  "recurrente": false,
  "comercial": false
}`;

function prompt(recibido: string) {
  return `Eres el editor de una agenda de eventos de Galicia (Val Miñor y Vigo). Extrae los datos de este cartel.

Mensaje recibido el ${recibido} (hora de Galicia). Si el cartel no indica el año, usa el de la próxima fecha posterior o igual a la de recepción.

Reglas:
- Horas en formato 24 h. Si pone "8:30" como cierre tras abrir a las 10:30, es 20:30. Anótalo en "inferido".
- Si hay programa por horas, una sesión por acto con "nota". Si son varios días con horarios distintos, una sesión por día.
- El concello puede deducirse del escudo o logo; indícalo en "inferido".
- Coordenadas: usa la tabla de lugares conocidos si coincide; si no, el centro de la parroquia o del concello y "aprox": true.
- "comercial": true si es la promoción de un negocio.
- "recurrente": true si indica edición (XVI…) o "un año más".
- No inventes precio, organizador ni datos de contacto. Lo que no esté, omítelo.
- "confianza" entre 0 y 1.

Lugares conocidos:
${JSON.stringify(LUGARES)}

Responde SOLO con un objeto JSON con esta forma (sin texto alrededor):
${ESQUEMA}`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY (ponla en .env.local o en la línea de comandos).");
    process.exit(1);
  }
  const client = new Anthropic();
  const imagenes = fs.readdirSync(ENTRADA).filter((f) => TIPOS[path.extname(f).toLowerCase()]);
  if (!imagenes.length) return console.log("No hay imágenes en data/entrada/");

  for (const f of imagenes) {
    const ruta = path.join(ENTRADA, f);
    const recibido = fechaDeNombre(f, fs.statSync(ruta).mtime);
    process.stdout.write(`→ ${f} … `);
    try {
      const res = await client.messages.create({
        model: MODELO,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: TIPOS[path.extname(f).toLowerCase()] as "image/jpeg", data: fs.readFileSync(ruta).toString("base64") },
              },
              { type: "text", text: prompt(recibido) },
            ],
          },
        ],
      });
      const texto = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
      json.fuente = { canal: "whatsapp", recibido };
      json._imagen = f; // se usa al publicar; se elimina después
      const destino = path.join(PENDIENTES, `${json.slug}.json`);
      fs.writeFileSync(destino, JSON.stringify(json, null, 2));
      console.log(`ok (${json.titulo}, confianza ${json.confianza})`);
    } catch (err) {
      console.log("ERROR", (err as Error).message);
    }
  }
}

main();
