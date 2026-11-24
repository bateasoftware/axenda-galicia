// WhatsApp Business Cloud API (Meta): verificación del webhook, descarga de archivos y envío de mensajes.
// Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
import { createHmac, timingSafeEqual } from "node:crypto";

export type ConfigWhatsApp = {
  /** Token permanente de un usuario del sistema (WHATSAPP_TOKEN) */
  token: string;
  /** Id del número de teléfono en Meta (WHATSAPP_PHONE_NUMBER_ID) */
  numeroId: string;
  /** Secreto de la app de Meta, para comprobar la firma de cada aviso (WHATSAPP_APP_SECRET) */
  secretoApp: string;
  /** Lo que se escribe en Meta al configurar el webhook (WHATSAPP_VERIFY_TOKEN) */
  tokenVerificacion: string;
  /** Plantilla aprobada para avisar al publicar fuera de la ventana de 24 h (WHATSAPP_PLANTILLA_PUBLICADO) */
  plantillaPublicado?: string;
  version: string;
};

export function configWhatsApp(env: Record<string, string | undefined> = process.env): ConfigWhatsApp | null {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN } = env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_APP_SECRET || !WHATSAPP_VERIFY_TOKEN) return null;
  return {
    token: WHATSAPP_TOKEN,
    numeroId: WHATSAPP_PHONE_NUMBER_ID,
    secretoApp: WHATSAPP_APP_SECRET,
    tokenVerificacion: WHATSAPP_VERIFY_TOKEN,
    plantillaPublicado: env.WHATSAPP_PLANTILLA_PUBLICADO || undefined,
    version: env.WHATSAPP_API_VERSION || "v23.0",
  };
}

/** Comprueba la cabecera X-Hub-Signature-256 (HMAC-SHA256 del cuerpo con el secreto de la app) */
export function firmaValida(cuerpo: string, cabecera: string | null, secretoApp: string): boolean {
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(createHmac("sha256", secretoApp).update(cuerpo, "utf8").digest("hex"));
  const recibida = Buffer.from(cabecera.slice(7));
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** Mensaje recibido, ya simplificado */
export type MensajeEntrante = {
  id: string;
  /** Número del remitente en formato internacional sin "+" (p. ej. "34600000000") */
  de: string;
  /** Segundos desde 1970 */
  fecha: number;
} & (
  | { tipo: "imagen"; mediaId: string; texto?: string }
  | { tipo: "documento"; mediaId: string; mime: string; nombre?: string; texto?: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "otro"; original: string }
);

type CuerpoWebhook = {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; caption?: string };
          document?: { id: string; mime_type: string; filename?: string; caption?: string };
        }[];
      };
    }[];
  }[];
};

/** Saca los mensajes de un aviso del webhook (ignora estados de entrega, lecturas, etc.) */
export function mensajesDelAviso(cuerpo: unknown): MensajeEntrante[] {
  const c = cuerpo as CuerpoWebhook;
  if (c?.object !== "whatsapp_business_account") return [];
  const r: MensajeEntrante[] = [];
  for (const entry of c.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const m of change.value?.messages ?? []) {
        const base = { id: m.id, de: m.from, fecha: Number(m.timestamp) };
        if (m.type === "image" && m.image) r.push({ ...base, tipo: "imagen", mediaId: m.image.id, texto: m.image.caption });
        else if (m.type === "document" && m.document)
          r.push({ ...base, tipo: "documento", mediaId: m.document.id, mime: m.document.mime_type, nombre: m.document.filename, texto: m.document.caption });
        else if (m.type === "text" && m.text) r.push({ ...base, tipo: "texto", texto: m.text.body });
        else r.push({ ...base, tipo: "otro", original: m.type });
      }
  return r;
}

export function clienteWhatsApp(cfg: ConfigWhatsApp, api = "https://graph.facebook.com") {
  const base = `${api}/${cfg.version}`;
  const auth = { Authorization: `Bearer ${cfg.token}` };

  async function enviar(cuerpo: Record<string, unknown>) {
    const res = await fetch(`${base}/${cfg.numeroId}/messages`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...cuerpo }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  return {
    /** Descarga un archivo recibido. Rechaza los que pasan de `maxBytes`. */
    async descargar(mediaId: string, maxBytes: number): Promise<{ datos: Buffer; mime: string }> {
      const meta = await fetch(`${base}/${mediaId}`, { headers: auth });
      if (!meta.ok) throw new Error(`WhatsApp media ${meta.status}`);
      const { url, mime_type, file_size } = (await meta.json()) as { url: string; mime_type: string; file_size?: number };
      if (file_size && file_size > maxBytes) throw new ArchivoGrande(file_size);
      const res = await fetch(url, { headers: auth });
      if (!res.ok) throw new Error(`WhatsApp descarga ${res.status}`);
      const datos = Buffer.from(await res.arrayBuffer());
      if (datos.length > maxBytes) throw new ArchivoGrande(datos.length);
      return { datos, mime: mime_type };
    },

    /** Texto libre: solo dentro de las 24 h siguientes al último mensaje de esa persona */
    texto(para: string, texto: string) {
      return enviar({ to: para, type: "text", text: { body: texto, preview_url: true } });
    },

    /** Aviso de publicación: plantilla si está configurada (vale fuera de las 24 h); si no, texto */
    async avisarPublicado(para: string, url: string, titulo: string) {
      if (cfg.plantillaPublicado)
        return enviar({
          to: para,
          type: "template",
          template: {
            name: cfg.plantillaPublicado,
            language: { code: "es" },
            components: [{ type: "body", parameters: [{ type: "text", text: titulo }, { type: "text", text: url }] }],
          },
        });
      return this.texto(para, mensajePublicado(titulo, url));
    },

    marcarLeido(mensajeId: string) {
      return enviar({ status: "read", message_id: mensajeId });
    },
  };
}

export class ArchivoGrande extends Error {
  constructor(public bytes: number) {
    super(`Archivo de ${Math.round(bytes / 1024 / 1024)} MB`);
  }
}

export const RESPUESTAS = {
  recibido: "¡Recibido! 🙌 Lo revisamos y te avisamos por aquí en cuanto esté publicado en Axenda.",
  recibidoVarios: (n: number) => `¡Recibido! 🙌 Hemos encontrado ${n} eventos. Los revisamos y te avisamos por aquí en cuanto estén publicados en Axenda.`,
  repetido: "Este cartel ya nos había llegado: lo tenemos en revisión o publicado. ¡Gracias!",
  sinEvento:
    "No hemos encontrado ningún evento en tu mensaje. Mándanos el cartel (foto o PDF) o escribe qué es, cuándo (día y hora) y dónde, y lo publicamos gratis en la agenda.",
  noSoportado: "Por ahora solo podemos leer carteles (foto o PDF) y mensajes de texto. ¡Gracias!",
  grande: "El archivo es demasiado grande. ¿Puedes mandarlo como foto o en un PDF más ligero?",
  error: "Ha habido un problema al leer tu envío. Lo miramos a mano y te decimos algo. ¡Gracias por tu paciencia!",
};

export const mensajePublicado = (titulo: string, url: string) => `Tu evento ya está en Axenda: ${titulo}\n${url}\n\n¡Gracias por mandarlo! Compártelo con quien quieras.`;
