// Entrada de eventos: cartel, programa en PDF o texto → extracción con IA → pendientes de revisión.
// Nada se publica solo. Dos destinos:
//  - un almacén (Turso o Supabase en Vercel, ficheros en local): se revisa en /admin
//  - un pull request en GitHub (si no hay base de datos): se revisa y se fusiona
// Los datos de quien envía nunca van al evento ni al PR; el contacto se guarda aparte y solo para avisarle.
import type { Almacen, Contacto } from "./almacen";
import { limpiarSlug as limpiar } from "./almacen/local";
import type { ClienteGitHub, PR } from "./github";
import type { EntradaExtraccion, EventoExtraido, ResultadoExtraccion, TipoArchivo } from "./extraccion";
import type { Canal, Evento, EventoBorrador } from "./tipos";
import { capitalizar, fechaLarga, hora } from "./fechas";
import { CATEGORIAS } from "./categorias";
import { validarEvento } from "./validacion";

export const ETIQUETA = "evento-entrante";
const ETIQUETA_REVISAR = "revisar-datos";
const RAMA_BASE = "main";

export type { Canal };

export type Entrada = {
  /** Imagen ya normalizada (JPEG) o PDF. Sin archivo, se extrae del texto de la nota. */
  archivo?: { datos: Buffer; tipo: TipoArchivo };
  /** Huella del fichero recibido, para detectar el mismo cartel dos veces */
  hash?: string;
  canal: Canal;
  recibido: string; // YYYY-MM-DDTHH:MM hora de Galicia
  nota?: string;
  /** Privado: solo para avisar al publicar */
  contacto?: Contacto;
};

export type Extraer = (e: EntradaExtraccion) => Promise<ResultadoExtraccion>;
/** Devuelve los posibles duplicados de un evento ("evento:<slug>" o "pendiente:<id>") */
export type BuscarDuplicados = (e: EventoBorrador) => string[];

export type EventoCreado = { id: string; titulo: string; errores: string[]; avisos: string[]; duplicados: string[] };

export type ResultadoEntrada =
  | { estado: "creado"; eventos: EventoCreado[]; pr?: string }
  | { estado: "duplicado"; pr?: string }
  | { estado: "vacio" }
  | { estado: "rechazado"; motivo: string };

const marcaHash = (hash: string) => `<!-- axenda:hash=${hash} -->`;

/** Normaliza el slug que propone el modelo; si no sirve, usa uno a partir de la fecha */
export function limpiarSlug(propuesto: string, recibido: string): string {
  return limpiar(propuesto, `evento-${recibido.slice(0, 10)}`);
}

/** Paso común: extraer y completar cada evento con su fuente y cartel provisional */
async function extraerEventos(entrada: Entrada, extraer: Extraer) {
  const r = await extraer({ archivo: entrada.archivo, recibido: entrada.recibido, nota: entrada.nota });
  if (r.tipo === "rechazado") return { error: `el modelo rechazó el envío (${r.categoria ?? "sin categoría"})` } as const;
  if (r.tipo === "incompleto") return { error: `respuesta incompleta (${r.motivo})` } as const;
  const eventos = r.eventos.map(
    (e: EventoExtraido): EventoBorrador => ({
      ...e,
      slug: limpiarSlug(e.slug, entrada.recibido),
      fuente: { canal: entrada.canal, recibido: entrada.recibido },
    }),
  );
  return { eventos } as const;
}

const comprobar = (e: EventoBorrador) => {
  // El cartel aún no está publicado: no se comprueba aquí
  const v = validarEvento(e, null);
  return { errores: v.ok ? [] : v.errores, avisos: v.avisos };
};

const esImagen = (a: Entrada["archivo"]): a is { datos: Buffer; tipo: "image/jpeg" | "image/png" | "image/webp" } =>
  !!a && a.tipo.startsWith("image/");

/** Destino almacén (Turso, Supabase o local): un pendiente por evento */
export async function procesarEntrada(
  entrada: Entrada,
  deps: { almacen: Almacen; extraer: Extraer; duplicados?: BuscarDuplicados },
): Promise<ResultadoEntrada> {
  const { almacen } = deps;
  if (entrada.hash && (await almacen.yaVisto({ hash: entrada.hash }))) return { estado: "duplicado" };

  const r = await extraerEventos(entrada, deps.extraer);
  if ("error" in r) return { estado: "rechazado", motivo: r.error! };
  if (!r.eventos.length) return { estado: "vacio" };

  const creados: EventoCreado[] = [];
  for (const [i, evento] of r.eventos.entries()) {
    const duplicados = deps.duplicados?.(evento) ?? [];
    const p = await almacen.crear({
      evento,
      // Un programa en PDF no lleva cartel; un cartel con varios actos se repite en cada uno
      cartel: esImagen(entrada.archivo) ? entrada.archivo : undefined,
      // El hash solo en el primero: basta para reconocer el envío
      hash: i === 0 ? entrada.hash : undefined,
      contacto: entrada.contacto,
      duplicados,
    });
    creados.push({ id: p.id, titulo: evento.titulo, duplicados, ...comprobar(evento) });
  }
  return { estado: "creado", eventos: creados };
}

/** Texto del pull request: lo justo para revisar desde el móvil. Nunca datos de quien lo envía. */
export function cuerpoPR(e: Evento, validacion: { errores: string[]; avisos: string[] }, hash?: string): string {
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
    hash ? marcaHash(hash) : "",
  ];
  return lineas.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

/** Primer slug libre: ni publicado en main ni con una rama de revisión abierta */
export async function slugLibre(gh: ClienteGitHub, slug: string, reservados: Set<string> = new Set()): Promise<string> {
  for (let n = 1; n <= 20; n++) {
    const candidato = n === 1 ? slug : `${slug}-${n}`;
    const ocupado =
      reservados.has(candidato) ||
      (await gh.existeFichero(`data/eventos/${candidato}.json`, RAMA_BASE)) ||
      (await gh.existeRama(`eventos/${candidato}`));
    if (!ocupado) return candidato;
  }
  throw new Error(`No hay slug libre para ${slug}`);
}

/** Destino GitHub: un pull request con todos los eventos del envío */
export async function procesarEntradaGitHub(entrada: Entrada, deps: { github: ClienteGitHub; extraer: Extraer }): Promise<ResultadoEntrada> {
  const { github: gh } = deps;

  // 1. ¿Ya llegó este mismo cartel? Si su PR sigue abierto, se avisa en él.
  if (entrada.hash) {
    const previo: PR | undefined = (await gh.prsConEtiqueta(ETIQUETA)).find((p) => p.cuerpo.includes(marcaHash(entrada.hash!)));
    if (previo) {
      if (previo.estado === "open")
        await gh.comentar(previo.numero, `El mismo cartel ha vuelto a llegar por ${entrada.canal} (${entrada.recibido.replace("T", " ")}).`);
      return { estado: "duplicado", pr: previo.url };
    }
  }

  // 2. Extracción con IA
  const r = await extraerEventos(entrada, deps.extraer);
  if ("error" in r) return { estado: "rechazado", motivo: r.error! };
  if (!r.eventos.length) return { estado: "vacio" };

  // 3. Slugs libres y cartel
  const reservados = new Set<string>();
  const eventos: Evento[] = [];
  for (const borrador of r.eventos) {
    const slug = await slugLibre(gh, borrador.slug, reservados);
    reservados.add(slug);
    eventos.push({ ...borrador, slug, ...(esImagen(entrada.archivo) ? { cartel: `/carteles/${slug}.jpg` } : {}) } as Evento);
  }
  const validaciones = eventos.map(comprobar);
  const conErrores = validaciones.some((v) => v.errores.length);

  // 4. Rama, ficheros y PR. El JSON se guarda aunque tenga errores: se corrige en el propio PR.
  const rama = `eventos/${eventos[0].slug}`;
  await gh.crearRama(rama, RAMA_BASE);
  for (const e of eventos) {
    if (esImagen(entrada.archivo)) await gh.subirFichero(rama, `public/carteles/${e.slug}.jpg`, entrada.archivo.datos, `Cartel: ${e.titulo}`);
    await gh.subirFichero(rama, `data/eventos/${e.slug}.json`, Buffer.from(JSON.stringify(e, null, 2) + "\n"), `Evento: ${e.titulo}`);
  }
  const e0 = eventos[0];
  const titulo =
    eventos.length === 1
      ? `${e0.titulo} · ${e0.sesiones[0]?.inicio.slice(0, 10) ?? "sin fecha"} · ${e0.concello}`
      : `${eventos.length} eventos: ${e0.titulo} y más · ${e0.concello}`;
  const cuerpo = eventos.map((e, i) => cuerpoPR(e, validaciones[i], i === eventos.length - 1 ? entrada.hash : undefined)).join("\n\n");
  const pr = await gh.crearPR({ titulo: `${conErrores ? "⚠️ " : ""}${titulo}`, cuerpo, rama, base: RAMA_BASE });
  const revisar = conErrores || eventos.some((e) => e.confianza < 0.8 || !!e.inferido?.length);
  await gh.etiquetar(pr.numero, revisar ? [ETIQUETA, ETIQUETA_REVISAR] : [ETIQUETA]);

  return {
    estado: "creado",
    pr: pr.url,
    eventos: eventos.map((e, i) => ({ id: e.slug, titulo: e.titulo, duplicados: [], ...validaciones[i] })),
  };
}
