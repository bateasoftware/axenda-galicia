import { fechaHoraGalicia } from "@/lib/fechas";
import { ArchivoNoValido, destinoConfigurado, prepararArchivo, recibir } from "@/lib/recepcion";

// POST /api/enviar (multipart/form-data): el formulario público de /enviar.
//   archivo   cartel (imagen) o programa (PDF), ≤ 4 MB. Opcional si se rellenan los datos.
//   que, cuando, donde, organiza, mas   datos del evento (texto libre, opcionales)
//   email     para avisar al publicarlo (opcional; se borra al avisar)
//   permiso   "si": tiene permiso para difundir el cartel
//   web       campo trampa: si viene relleno, es un bot
//   cf-turnstile-response   si Turnstile está configurado
// Todo entra como pendiente de revisión.

export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Límite por IP en memoria (orientativo: en serverless cada instancia lleva su cuenta)
const envios = new Map<string, number[]>();
function demasiados(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (envios.get(ip) ?? []).filter((t) => ahora - t < 60 * 60 * 1000);
  recientes.push(ahora);
  envios.set(ip, recientes);
  return recientes.length > 8;
}

async function turnstileValido(token: string, ip: string | null): Promise<boolean> {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
  if (!secreto) return true;
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: secreto, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  return ((await res.json()) as { success?: boolean }).success === true;
}

const respuesta = (estado: number, cuerpo: Record<string, unknown>) => Response.json(cuerpo, { status: estado });

export async function POST(request: Request) {
  if (!destinoConfigurado()) return respuesta(503, { estado: "error", motivo: "El envío por formulario no está disponible ahora mismo. Escríbenos por email." });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  if (ip && demasiados(ip)) return respuesta(429, { estado: "error", motivo: "Has enviado muchos eventos seguidos. Prueba dentro de un rato." });

  let datos: FormData;
  try {
    datos = await request.formData();
  } catch {
    return respuesta(400, { estado: "error", motivo: "Envío no válido." });
  }
  const texto = (k: string) => String(datos.get(k) ?? "").trim().slice(0, 1000);

  // Bot: se le responde como si nada
  if (texto("web")) return respuesta(200, { estado: "creado", eventos: [] });
  if (!(await turnstileValido(texto("cf-turnstile-response"), ip))) return respuesta(400, { estado: "error", motivo: "No hemos podido comprobar que no eres un robot. Recarga la página y prueba otra vez." });
  if (texto("permiso") !== "si") return respuesta(400, { estado: "error", motivo: "Marca la casilla de permiso para difundir el cartel." });

  const email = texto("email");
  if (email && !RE_EMAIL.test(email)) return respuesta(400, { estado: "error", motivo: "El email no parece correcto." });

  const campos: [string, string][] = [
    ["Qué", texto("que")],
    ["Cuándo", texto("cuando")],
    ["Dónde", texto("donde")],
    ["Organiza", texto("organiza")],
    ["Más información", texto("mas")],
  ];
  const nota = campos
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const fichero = datos.get("archivo");
  const hayFichero = fichero instanceof File && fichero.size > 0;
  if (!hayFichero && (!texto("que") || !texto("cuando") || !texto("donde")))
    return respuesta(400, { estado: "error", motivo: "Sube el cartel o rellena al menos qué, cuándo y dónde." });
  if (hayFichero && fichero.size > MAX_BYTES) return respuesta(413, { estado: "error", motivo: "El archivo pasa de 4 MB. Prueba con una foto o un PDF más ligero." });

  let preparado: Awaited<ReturnType<typeof prepararArchivo>> | undefined;
  if (hayFichero) {
    try {
      preparado = await prepararArchivo(Buffer.from(await fichero.arrayBuffer()));
    } catch (err) {
      if (err instanceof ArchivoNoValido) return respuesta(415, { estado: "error", motivo: "El archivo tiene que ser una imagen (JPG, PNG, WebP) o un PDF." });
      throw err;
    }
  }

  try {
    const r = await recibir({
      ...preparado,
      canal: "formulario",
      recibido: fechaHoraGalicia(),
      nota: nota || undefined,
      // El email solo se guarda para avisar al publicar
      contacto: email ? { canal: "email", valor: email } : undefined,
    });
    if (r.estado === "rechazado") return respuesta(422, { estado: "error", motivo: "No hemos podido leer el evento. Revisa el archivo o escríbenos por email." });
    return respuesta(r.estado === "creado" ? 201 : 200, { estado: r.estado, eventos: r.estado === "creado" ? r.eventos.length : 0 });
  } catch (err) {
    console.error("[enviar]", err);
    return respuesta(502, { estado: "error", motivo: "Ha fallado algo por nuestra parte. Prueba en un rato o escríbenos por email." });
  }
}
