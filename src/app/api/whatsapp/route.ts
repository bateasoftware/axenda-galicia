import { after } from "next/server";
import { remotoConfigurado } from "@/lib/almacen";
import { fechaHoraGalicia } from "@/lib/fechas";
import { ArchivoNoValido, destinoConfigurado, prepararArchivo, recibir } from "@/lib/recepcion";
import { ArchivoGrande, clienteWhatsApp, configWhatsApp, firmaValida, mensajesDelAviso, RESPUESTAS, type MensajeEntrante } from "@/lib/whatsapp";

// Webhook de WhatsApp Business (Cloud API). Ver docs/pendientes-juan.md (bloque 5) para darlo de alta en Meta.
//  GET  → verificación al configurar el webhook (hub.challenge)
//  POST → mensajes: carteles (imagen), programas (PDF) y texto → pendientes de revisión + respuesta automática
// Se responde 200 al momento (Meta reintenta si tarda) y el trabajo sigue con after().

export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024; // límite práctico para la IA (PDF)

export async function GET(request: Request) {
  const cfg = configWhatsApp();
  const q = new URL(request.url).searchParams;
  if (cfg && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === cfg.tokenVerificacion)
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  return new Response("No autorizado", { status: 403 });
}

export async function POST(request: Request) {
  const cfg = configWhatsApp();
  if (!cfg) return new Response("WhatsApp no configurado", { status: 503 });
  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), cfg.secretoApp)) return new Response("Firma no válida", { status: 401 });

  let mensajes: MensajeEntrante[] = [];
  try {
    mensajes = mensajesDelAviso(JSON.parse(cuerpo));
  } catch {
    return new Response("JSON no válido", { status: 400 });
  }
  if (mensajes.length) after(() => procesar(mensajes));
  return new Response("ok", { status: 200 });
}

/** Un texto sin cifras y corto ("hola", "gracias") no se manda a la IA */
const pareceEvento = (texto: string) => texto.trim().length >= 40 && /\d/.test(texto);

async function procesar(mensajes: MensajeEntrante[]) {
  const cfg = configWhatsApp()!;
  const wa = clienteWhatsApp(cfg);
  const listo = !!destinoConfigurado();

  for (const m of mensajes) {
    const responder = (texto: string) => wa.texto(m.de, texto).catch((err) => console.error("[whatsapp] no se pudo responder:", err));
    await wa.marcarLeido(m.id).catch(() => {});
    if (!listo) {
      console.error("[whatsapp] falta configuración (IA o base de datos): el mensaje no se procesa");
      await responder(RESPUESTAS.error);
      continue;
    }
    try {
      if (m.tipo === "otro") {
        await responder(RESPUESTAS.noSoportado);
        continue;
      }
      if (m.tipo === "texto" && !pareceEvento(m.texto)) {
        await responder(RESPUESTAS.sinEvento);
        continue;
      }
      let preparado: Awaited<ReturnType<typeof prepararArchivo>> | undefined;
      if (m.tipo === "imagen" || m.tipo === "documento") {
        if (m.tipo === "documento" && m.mime !== "application/pdf" && !m.mime.startsWith("image/")) {
          await responder(RESPUESTAS.noSoportado);
          continue;
        }
        const { datos } = await wa.descargar(m.mediaId, MAX_BYTES);
        preparado = await prepararArchivo(datos);
      }
      const r = await recibir({
        ...preparado,
        canal: "whatsapp",
        recibido: fechaHoraGalicia(new Date(m.fecha * 1000)),
        nota: m.texto,
        // El número solo se guarda para avisar al publicar (y solo en la base de datos, nunca en git)
        contacto: remotoConfigurado() || !process.env.VERCEL ? { canal: "whatsapp", valor: m.de } : undefined,
      });
      if (r.estado === "creado") await responder(r.eventos.length > 1 ? RESPUESTAS.recibidoVarios(r.eventos.length) : RESPUESTAS.recibido);
      else if (r.estado === "duplicado") await responder(RESPUESTAS.repetido);
      else if (r.estado === "vacio") await responder(RESPUESTAS.sinEvento);
      else {
        console.error("[whatsapp] rechazado:", r.motivo);
        await responder(RESPUESTAS.error);
      }
    } catch (err) {
      console.error("[whatsapp]", err);
      await responder(err instanceof ArchivoGrande ? RESPUESTAS.grande : err instanceof ArchivoNoValido ? RESPUESTAS.noSoportado : RESPUESTAS.error);
    }
  }
}
