"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { almacen, slugLibre, type Almacen } from "@/lib/almacen";
import { formularioAEvento } from "@/lib/admin/formulario";
import { COOKIE_PUBLICADO, type ResultadoPublicacion } from "@/lib/admin/publicacion";
import { abrirSesion, cerrarSesion, claveCorrecta, exigirAdmin } from "@/lib/admin/sesion";
import { ETIQUETA_EVENTOS, eventosDelRepositorio, todosLosEventos } from "@/lib/eventos";
import { prepararArchivo } from "@/lib/recepcion";
import { SITIO } from "@/lib/sitio";
import { validarEvento } from "@/lib/validacion";
import { clienteWhatsApp, configWhatsApp, mensajePublicado } from "@/lib/whatsapp";

export type EstadoEntrar = { error?: string };

export async function entrar(_previo: EstadoEntrar, f: FormData): Promise<EstadoEntrar> {
  // Una pequeña espera dificulta probar contraseñas a lo bruto
  await new Promise((r) => setTimeout(r, 600));
  if (!claveCorrecta(String(f.get("clave") ?? ""))) return { error: "Contraseña incorrecta." };
  await abrirSesion();
  redirect("/admin");
}

export async function salir() {
  await cerrarSesion();
  redirect("/admin/entrar");
}

export type EstadoRevision = { tipo: "inicial" } | { tipo: "errores"; errores: string[] } | { tipo: "guardado"; avisos: string[]; enWeb?: boolean };

/** Si el formulario trae un cartel nuevo, lo guarda (reducido y sin metadatos). Devuelve el error, si lo hay. */
async function guardarCartel(a: Almacen, id: string, f: FormData, estado: "pendiente" | "publicado"): Promise<string | null> {
  const archivo = f.get("cartel");
  if (!(archivo instanceof File) || !archivo.size) return null;
  try {
    const p = await prepararArchivo(Buffer.from(await archivo.arrayBuffer()));
    if (p.archivo.tipo !== "image/jpeg") return "El cartel tiene que ser una imagen (JPG, PNG o WebP), no un PDF.";
    await a.ponerCartel(id, { datos: p.archivo.datos, tipo: "image/jpeg" }, estado);
    return null;
  } catch {
    return "No se ha podido guardar el cartel: comprueba que es una imagen válida.";
  }
}

/** Guarda los cambios o publica, según el botón pulsado ("accion": guardar | publicar) */
export async function revisar(id: string, _previo: EstadoRevision, f: FormData): Promise<EstadoRevision> {
  await exigirAdmin();
  const a = almacen();
  const p = await a.pendiente(id);
  if (!p) return { tipo: "errores", errores: ["Este pendiente ya no existe (¿publicado o descartado en otra pestaña?)."] };

  const { evento, errores } = formularioAEvento(f, p.evento);
  if (errores.length) return { tipo: "errores", errores };

  if (f.get("accion") !== "publicar") {
    await a.guardar(id, evento);
    const errorCartel = await guardarCartel(a, id, f, "pendiente");
    if (errorCartel) return { tipo: "errores", errores: [errorCartel] };
    const v = validarEvento(evento, null);
    return { tipo: "guardado", avisos: v.ok ? v.avisos : [...v.errores.map((e) => `Para publicar falta: ${e}`), ...v.avisos] };
  }

  // Publicar: slug libre entre todo lo publicado y validación estricta
  const ocupados = new Set((await todosLosEventos()).map((e) => e.slug));
  const slug = slugLibre(evento.slug, (s) => ocupados.has(s));
  const v = validarEvento({ ...evento, slug }, null);
  if (!v.ok) {
    await a.guardar(id, evento);
    return { tipo: "errores", errores: v.errores };
  }
  // Los avisos de "deducido" ya los ha revisado quien publica
  const { inferido: _inferido, ...limpio } = v.valor;
  void _inferido;
  // Un cartel nuevo se guarda antes de publicar para que salga con él
  await a.guardar(id, evento);
  const errorCartel = await guardarCartel(a, id, f, "pendiente");
  if (errorCartel) return { tipo: "errores", errores: [errorCartel] };
  const r = await a.publicar(id, limpio);
  updateTag(ETIQUETA_EVENTOS);

  const url = `${SITIO.url}/evento/${r.slug}`;
  const mensaje = mensajePublicado(limpio.titulo, url);
  let aviso: ResultadoPublicacion["aviso"] = { tipo: "ninguno" };
  if (r.contacto?.canal === "whatsapp") {
    const cfg = configWhatsApp();
    try {
      if (!cfg) throw new Error("WhatsApp sin configurar");
      await clienteWhatsApp(cfg).avisarPublicado(r.contacto.valor, url, limpio.titulo);
      aviso = { tipo: "whatsapp-enviado" };
    } catch (err) {
      console.error("[admin] aviso por WhatsApp:", err);
      aviso = { tipo: "whatsapp-error", numero: r.contacto.valor };
    }
  } else if (r.contacto?.canal === "email") aviso = { tipo: "email", email: r.contacto.valor };
  // El contacto solo servía para este aviso: se borra (se muestra una última vez si hay que avisar a mano)
  if (r.contacto) await a.olvidarContacto(a.tipo === "local" ? r.slug : id);

  const resultado: ResultadoPublicacion = { slug: r.slug, url, mensaje, aviso, avisos: v.avisos.filter((x) => !x.startsWith("deducido")) };
  (await cookies()).set(COOKIE_PUBLICADO, JSON.stringify(resultado), { httpOnly: true, sameSite: "strict", path: "/admin", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  redirect(`/admin/publicado/${r.slug}`);
}

/** Descarta a la vez los pendientes marcados en la lista. Los descartados no vuelven a entrar al importar. */
export async function descartarVarios(f: FormData) {
  await exigirAdmin();
  const a = almacen();
  const ids = [...new Set(f.getAll("ids").map(String))].slice(0, 300);
  let n = 0;
  for (const id of ids) {
    try {
      await a.descartar(id);
      n++;
    } catch (err) {
      console.error("[admin] no se pudo descartar", id, err);
    }
  }
  // Se vuelve a la misma vista filtrada (solo valores simples)
  const emisor = String(f.get("emisor") ?? "");
  const ver = String(f.get("ver") ?? "");
  const q = new URLSearchParams();
  if (/^[a-z0-9-]+$/.test(emisor)) q.set("emisor", emisor);
  if (/^[a-z]+$/.test(ver)) q.set("ver", ver);
  q.set("descartados", String(n));
  redirect(`/admin?${q}`);
}

export async function descartar(id: string) {
  await exigirAdmin();
  await almacen().descartar(id);
  redirect("/admin?descartado=1");
}

/** Evento publicado: de la base de datos (id) o de data/eventos ("git.<slug>"; en local son los mismos ficheros) */
async function publicadoPorId(a: Almacen, id: string) {
  if (id.startsWith("git.") && a.tipo !== "local") {
    const e = eventosDelRepositorio().find((x) => x.slug === id.slice(4));
    return e ? { id, evento: e, git: true as const } : null;
  }
  const p = await a.publicado(id);
  return p ? { ...p, git: false as const } : null;
}

/** Guarda los cambios de un evento ya publicado (y su cartel, si se sube uno) */
export async function editarPublicado(id: string, _previo: EstadoRevision, f: FormData): Promise<EstadoRevision> {
  await exigirAdmin();
  const a = almacen();
  const actual = await publicadoPorId(a, id);
  if (!actual) return { tipo: "errores", errores: ["Este evento ya no está publicado (¿retirado en otra pestaña?)."] };

  const { evento, errores } = formularioAEvento(f, actual.evento);
  if (errores.length) return { tipo: "errores", errores };
  // La dirección de la página no cambia nunca: los enlaces que ya se han compartido siguen funcionando
  const v = validarEvento({ ...evento, slug: actual.evento.slug }, null);
  if (!v.ok) return { tipo: "errores", errores: v.errores };

  let destino = id;
  if (actual.git) destino = (await a.adoptar(v.valor)).id; // pasa a la base de datos: gana al de data/eventos
  else await a.guardarPublicado(id, v.valor);
  const errorCartel = await guardarCartel(a, destino, f, "publicado");
  updateTag(ETIQUETA_EVENTOS);
  if (errorCartel) return { tipo: "errores", errores: [`Los cambios se han guardado, pero: ${errorCartel}`] };
  if (actual.git) redirect(`/admin/publicados/${destino}?guardado=1`);
  return { tipo: "guardado", enWeb: true, avisos: v.avisos.filter((x) => !x.startsWith("deducido")) };
}

/** Quita un evento de la web. Queda guardado como descartado en la base de datos (o se borra el fichero en local). */
export async function retirarPublicado(id: string) {
  await exigirAdmin();
  const a = almacen();
  const actual = await publicadoPorId(a, id);
  if (actual?.git) await a.retirarSlug(actual.evento.slug);
  else if (actual) await a.retirar(id);
  updateTag(ETIQUETA_EVENTOS);
  redirect("/admin/publicados?retirado=1");
}
