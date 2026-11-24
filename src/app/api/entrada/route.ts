import { timingSafeEqual } from "node:crypto";
import { procesarEntrada, type Canal } from "@/lib/entrada";
import { extraerCartel } from "@/lib/extraccion";
import { fechaHoraGalicia } from "@/lib/fechas";
import { clienteGitHub, ErrorGitHub } from "@/lib/github";
import { normalizarCartel } from "@/lib/imagen";

// POST /api/entrada  (multipart/form-data)
//   imagen    fichero del cartel (obligatorio, ≤ 4 MB: Vercel no acepta peticiones de más de 4,5 MB)
//   canal     email | formulario | whatsapp | manual
//   recibido  YYYY-MM-DDTHH:MM en hora de Galicia (opcional; por defecto, ahora)
//   nota      texto que acompañaba al cartel (opcional)
// Cabecera: Authorization: Bearer <ENTRADA_SECRETO>
// Respuesta: { estado: "creado" | "duplicado" | "rechazado", pr?, slug?, errores?, avisos?, motivo? }

export const maxDuration = 120; // la extracción con IA tarda entre 10 y 60 s

const MAX_BYTES = 4 * 1024 * 1024;
const CANALES: Canal[] = ["email", "formulario", "whatsapp", "manual"];

function autorizado(cabecera: string | null): boolean {
  const secreto = process.env.ENTRADA_SECRETO;
  if (!secreto || !cabecera?.startsWith("Bearer ")) return false;
  const a = Buffer.from(cabecera.slice(7));
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

const respuesta = (estado: number, cuerpo: Record<string, unknown>) => Response.json(cuerpo, { status: estado });

export async function POST(request: Request) {
  const { GITHUB_TOKEN, GITHUB_REPO, ANTHROPIC_API_KEY } = process.env;
  if (!process.env.ENTRADA_SECRETO || !GITHUB_TOKEN || !GITHUB_REPO || !ANTHROPIC_API_KEY)
    return respuesta(503, { estado: "error", motivo: "La entrada automática no está configurada (faltan variables de entorno)." });
  if (!autorizado(request.headers.get("authorization"))) return respuesta(401, { estado: "error", motivo: "No autorizado." });

  let datos: FormData;
  try {
    datos = await request.formData();
  } catch {
    return respuesta(400, { estado: "error", motivo: "Se esperaba multipart/form-data." });
  }

  const fichero = datos.get("imagen");
  if (!(fichero instanceof File) || !fichero.size) return respuesta(400, { estado: "error", motivo: "Falta la imagen." });
  if (fichero.size > MAX_BYTES) return respuesta(413, { estado: "error", motivo: "La imagen pasa de 4 MB." });

  const canal = String(datos.get("canal") ?? "manual") as Canal;
  if (!CANALES.includes(canal)) return respuesta(400, { estado: "error", motivo: `Canal no válido: ${canal}` });
  const recibidoCampo = String(datos.get("recibido") ?? "");
  const recibido = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(recibidoCampo) ? recibidoCampo : fechaHoraGalicia();
  const nota = datos.get("nota");

  let cartel: Awaited<ReturnType<typeof normalizarCartel>>;
  try {
    cartel = await normalizarCartel(Buffer.from(await fichero.arrayBuffer()));
  } catch {
    return respuesta(415, { estado: "error", motivo: "El fichero no es una imagen válida." });
  }

  try {
    const r = await procesarEntrada(
      { ...cartel, canal, recibido, nota: typeof nota === "string" ? nota : undefined },
      { github: clienteGitHub({ token: GITHUB_TOKEN, repo: GITHUB_REPO }), extraer: (args) => extraerCartel(args) },
    );
    return respuesta(r.estado === "creado" ? 201 : 200, r);
  } catch (err) {
    console.error("[entrada]", err);
    const motivo = err instanceof ErrorGitHub ? `Error de GitHub (${err.estado}).` : "Error al procesar el cartel.";
    return respuesta(502, { estado: "error", motivo });
  }
}
