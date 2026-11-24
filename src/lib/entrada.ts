// Entrada de eventos: cartel → extracción con IA → pull request para revisar.
// Nada se publica solo: el evento aparece en la web cuando alguien fusiona el PR.
import type { ClienteGitHub, PR } from "./github";
import type { EventoExtraido, ResultadoExtraccion } from "./extraccion";
import type { Evento } from "./tipos";
import { capitalizar, fechaLarga, hora } from "./fechas";
import { CATEGORIAS } from "./categorias";
import { validarEvento } from "./validacion";

export const ETIQUETA = "evento-entrante";
const ETIQUETA_REVISAR = "revisar-datos";
const RAMA_BASE = "main";

export type Canal = Evento["fuente"]["canal"];

export type Entrada = {
  imagen: Buffer; // ya normalizada (JPEG)
  hash: string; // del fichero recibido, para detectar duplicados
  canal: Canal;
  recibido: string; // YYYY-MM-DDTHH:MM hora de Galicia
  nota?: string;
};

export type ResultadoEntrada =
  | { estado: "creado"; pr: string; slug: string; errores: string[]; avisos: string[] }
  | { estado: "duplicado"; pr: string }
  | { estado: "rechazado"; motivo: string };

const marcaHash = (hash: string) => `<!-- axenda:hash=${hash} -->`;

/** Normaliza el slug que propone el modelo; si no sirve, usa uno a partir de la fecha */
export function limpiarSlug(propuesto: string, recibido: string): string {
  const s = propuesto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
  return s || `evento-${recibido.slice(0, 10)}`;
}

/** Primer slug libre: ni publicado en main ni con una rama de revisión abierta */
export async function slugLibre(gh: ClienteGitHub, slug: string): Promise<string> {
  for (let n = 1; n <= 20; n++) {
    const candidato = n === 1 ? slug : `${slug}-${n}`;
    const ocupado =
      (await gh.existeFichero(`data/eventos/${candidato}.json`, RAMA_BASE)) || (await gh.existeRama(`eventos/${candidato}`));
    if (!ocupado) return candidato;
  }
  throw new Error(`No hay slug libre para ${slug}`);
}

/** Texto del pull request: lo justo para revisar desde el móvil. Nunca datos de quien lo envía. */
export function cuerpoPR(e: Evento, validacion: { errores: string[]; avisos: string[] }, hash: string): string {
  const sesiones = e.sesiones
    .map((s) => `- ${capitalizar(fechaLarga(s.inicio))} · ${hora(s.inicio)}${s.fin ? `–${hora(s.fin)}` : ""}${s.nota ? ` · ${s.nota}` : ""}`)
    .join("\n");
  const lugares = e.lugares.map((l) => `- ${l.nombre}${l.aprox ? " _(coordenadas aproximadas)_" : ""}`).join("\n");
  const lineas = [
    `## ${e.titulo}`,
    e.titulo_gl && e.titulo_gl !== e.titulo ? `_${e.titulo_gl}_\n` : "",
    e.resumen,
    "",
    `**Cuándo**\n${sesiones}`,
    "",
    `**Dónde** · ${e.parroquia ? `${e.parroquia}, ` : ""}${e.concello}\n${lugares}`,
    "",
    `**Categorías:** ${e.categorias.map((c) => `${CATEGORIAS[c]?.emoji ?? ""} ${CATEGORIAS[c]?.nombre ?? c}`).join(", ")}`,
    e.organizadores.length ? `**Organiza:** ${e.organizadores.join(", ")}` : "",
    e.precio ? `**Precio:** ${e.precio}` : "",
    e.comercial ? "**Promoción de comercio**" : "",
    "",
    `**Confianza de la extracción:** ${Math.round(e.confianza * 100)} %`,
    e.inferido?.length ? `**Deducido (revisar):** ${e.inferido.join(", ")}` : "",
    validacion.errores.length ? `\n### ✗ Hay que corregir antes de fusionar\n${validacion.errores.map((x) => `- ${x}`).join("\n")}` : "",
    "",
    "---",
    `Recibido por ${e.fuente.canal} el ${e.fuente.recibido.replace("T", " a las ")}.`,
    `Revisa el cartel y la vista previa de Vercel. **Fusiona** para publicar, **edita** \`data/eventos/${e.slug}.json\` en este PR para corregir o **cierra** el PR para descartarlo.`,
    marcaHash(hash),
  ];
  return lineas.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export async function procesarEntrada(
  entrada: Entrada,
  deps: {
    github: ClienteGitHub;
    extraer: (args: { imagen: Buffer; tipo: "image/jpeg"; recibido: string; nota?: string }) => Promise<ResultadoExtraccion>;
  },
): Promise<ResultadoEntrada> {
  const { github: gh } = deps;

  // 1. ¿Ya llegó este mismo cartel? Si su PR sigue abierto, se avisa en él.
  const previo: PR | undefined = (await gh.prsConEtiqueta(ETIQUETA)).find((p) => p.cuerpo.includes(marcaHash(entrada.hash)));
  if (previo) {
    if (previo.estado === "open")
      await gh.comentar(previo.numero, `El mismo cartel ha vuelto a llegar por ${entrada.canal} (${entrada.recibido.replace("T", " ")}).`);
    return { estado: "duplicado", pr: previo.url };
  }

  // 2. Extracción con IA
  const r = await deps.extraer({ imagen: entrada.imagen, tipo: "image/jpeg", recibido: entrada.recibido, nota: entrada.nota });
  if (r.tipo === "rechazado") return { estado: "rechazado", motivo: `el modelo rechazó el cartel (${r.categoria ?? "sin categoría"})` };
  if (r.tipo === "incompleto") return { estado: "rechazado", motivo: `respuesta incompleta (${r.motivo})` };

  // 3. Evento completo con slug libre, cartel y fuente
  const slug = await slugLibre(gh, limpiarSlug(r.evento.slug, entrada.recibido));
  const evento = {
    ...(r.evento as EventoExtraido),
    slug,
    cartel: `/carteles/${slug}.jpg`,
    fuente: { canal: entrada.canal, recibido: entrada.recibido },
  } as Evento;
  // El cartel aún no está en el repo: no se comprueba aquí (lo hace la CI en el PR)
  const v = validarEvento(evento, null, `${slug}.json`);
  const validacion = { errores: v.ok ? [] : v.errores, avisos: v.avisos };

  // 4. Rama, ficheros y PR. El JSON se guarda aunque tenga errores: se corrige en el propio PR.
  const rama = `eventos/${slug}`;
  await gh.crearRama(rama, RAMA_BASE);
  await gh.subirFichero(rama, `public/carteles/${slug}.jpg`, entrada.imagen, `Cartel: ${evento.titulo}`);
  await gh.subirFichero(rama, `data/eventos/${slug}.json`, Buffer.from(JSON.stringify(evento, null, 2) + "\n"), `Evento: ${evento.titulo}`);
  const pr = await gh.crearPR({
    titulo: `${validacion.errores.length ? "⚠️ " : ""}${evento.titulo} · ${evento.sesiones[0]?.inicio.slice(0, 10) ?? "sin fecha"} · ${evento.concello}`,
    cuerpo: cuerpoPR(evento, validacion, entrada.hash),
    rama,
    base: RAMA_BASE,
  });
  const revisar = validacion.errores.length > 0 || evento.confianza < 0.8 || !!evento.inferido?.length;
  await gh.etiquetar(pr.numero, revisar ? [ETIQUETA, ETIQUETA_REVISAR] : [ETIQUETA]);

  return { estado: "creado", pr: pr.url, slug, ...validacion };
}
