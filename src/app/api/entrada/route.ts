import { timingSafeEqual } from "node:crypto";
import type { Canal } from "@/lib/entrada";
import { fechaHoraGalicia } from "@/lib/fechas";
import { ErrorGitHub } from "@/lib/github";
import { ArchivoNoValido, destinoConfigurado, prepararArchivo, recibir } from "@/lib/recepcion";

// POST /api/entrada  (multipart/form-data) — para integraciones de confianza (Apps Script de Gmail, curl)
//   imagen    cartel (imagen) o programa (PDF); obligatorio salvo que venga "nota" con el texto del evento
//             ≤ 4 MB: Vercel no acepta peticiones de más de 4,5 MB
//   canal     email | formulario | whatsapp | manual
//   recibido  YYYY-MM-DDTHH:MM en hora de Galicia (opcional; por defecto, ahora)
//   nota      texto que acompañaba al cartel (opcional)
// Cabecera: Authorization: Bearer <ENTRADA_SECRETO>
// Respuesta: { estado: "creado" | "duplicado" | "vacio" | "rechazado", eventos?, pr?, motivo? }
// Destino: pendientes en Supabase (se revisan en /admin) o, sin Supabase, un pull request en GitHub.

export const maxDuration = 300; // un programa largo en PDF puede tardar varios minutos

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
  if (!process.env.ENTRADA_SECRETO || !destinoConfigurado())
    return respuesta(503, { estado: "error", motivo: "La entrada automática no está configurada (faltan variables de entorno)." });
  if (!autorizado(request.headers.get("authorization"))) return respuesta(401, { estado: "error", motivo: "No autorizado." });

  let datos: FormData;
  try {
    datos = await request.formData();
  } catch {
    return respuesta(400, { estado: "error", motivo: "Se esperaba multipart/form-data." });
  }

  const fichero = datos.get("imagen");
  const notaCampo = datos.get("nota");
  const nota = typeof notaCampo === "string" && notaCampo.trim() ? notaCampo : undefined;
  const hayFichero = fichero instanceof File && fichero.size > 0;
  if (!hayFichero && !nota) return respuesta(400, { estado: "error", motivo: "Falta la imagen o el texto del evento." });
  if (hayFichero && fichero.size > MAX_BYTES) return respuesta(413, { estado: "error", motivo: "El archivo pasa de 4 MB." });

  const canal = String(datos.get("canal") ?? "manual") as Canal;
  if (!CANALES.includes(canal)) return respuesta(400, { estado: "error", motivo: `Canal no válido: ${canal}` });
  const recibidoCampo = String(datos.get("recibido") ?? "");
  const recibido = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(recibidoCampo) ? recibidoCampo : fechaHoraGalicia();

  let preparado: Awaited<ReturnType<typeof prepararArchivo>> | undefined;
  if (hayFichero) {
    try {
      preparado = await prepararArchivo(Buffer.from(await fichero.arrayBuffer()));
    } catch (err) {
      if (err instanceof ArchivoNoValido) return respuesta(415, { estado: "error", motivo: err.message });
      throw err;
    }
  }

  try {
    const r = await recibir({ ...preparado, canal, recibido, nota });
    return respuesta(r.estado === "creado" ? 201 : 200, r);
  } catch (err) {
    console.error("[entrada]", err);
    const motivo = err instanceof ErrorGitHub ? `Error de GitHub (${err.estado}).` : "Error al procesar el envío.";
    return respuesta(502, { estado: "error", motivo });
  }
}
