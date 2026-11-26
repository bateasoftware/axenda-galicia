"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { almacen, slugLibre, type Almacen } from "@/lib/almacen";
import { filtrarCola, filtroSeguro, consultaFiltro, ordenarCola, vecinos, type FiltroCola } from "@/lib/admin/cola";
import { fiablesAhora } from "@/lib/admin/fiables";
import { formularioAEvento } from "@/lib/admin/formulario";
import { lugaresHabituales } from "@/lib/lugares-datos";
import { mismoLugar, tablaCon, type LugarConocido } from "@/lib/lugares";
import { COOKIE_LOTE, prepararPublicacion, type Omitido, type ResultadoLote } from "@/lib/admin/lote";
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

/** Guarda como lugares habituales los que se marcaron en el formulario (solo si son nuevos o han cambiado) */
async function guardarHabituales(a: Almacen, nuevos: LugarConocido[]) {
  if (!nuevos.length) return;
  const actuales = await lugaresHabituales(a);
  for (const l of nuevos) {
    const igual = actuales.find((x) => mismoLugar(x, l));
    if (!igual) await a.guardarLugar(l);
  }
}

/** El filtro de la cola que viaja con el formulario (campos ocultos emisor y ver) */
const filtroDe = (f: FormData): FiltroCola => filtroSeguro(String(f.get("emisor") ?? ""), String(f.get("ver") ?? ""));

/** El pendiente que toca después de `id` en la cola filtrada (se calcula antes de publicarlo o descartarlo) */
async function siguienteDe(a: Almacen, id: string, filtro: FiltroCola) {
  return vecinos(filtrarCola(ordenarCola(await a.pendientes()), filtro), id).siguiente;
}

/** Dirección de un pendiente dentro de la cola, con el filtro y un aviso de lo que se acaba de hacer */
function enCola(id: string, filtro: FiltroCola, aviso: Record<string, string> = {}) {
  const q = new URLSearchParams(consultaFiltro(filtro).slice(1));
  for (const [k, v] of Object.entries(aviso)) q.set(k, v);
  return `/admin/${id}${q.size ? `?${q}` : ""}`;
}

/** Guarda los cambios o publica, según el botón pulsado ("accion": guardar | guardar-siguiente | publicar) */
export async function revisar(id: string, _previo: EstadoRevision, f: FormData): Promise<EstadoRevision> {
  await exigirAdmin();
  const a = almacen();
  const p = await a.pendiente(id);
  if (!p) return { tipo: "errores", errores: ["Este pendiente ya no existe (¿publicado o descartado en otra pestaña?)."] };

  const tabla = tablaCon(await lugaresHabituales(a));
  const { evento, errores, guardarLugares } = formularioAEvento(f, p.evento, tabla);
  if (errores.length) return { tipo: "errores", errores };
  await guardarHabituales(a, guardarLugares);

  const filtro = filtroDe(f);
  if (f.get("accion") !== "publicar") {
    await a.guardar(id, evento);
    const errorCartel = await guardarCartel(a, id, f, "pendiente");
    if (errorCartel) return { tipo: "errores", errores: [errorCartel] };
    const v = validarEvento(evento, null);
    if (f.get("accion") === "guardar-siguiente") {
      const siguiente = await siguienteDe(a, id, filtro);
      if (siguiente && siguiente.id !== id) redirect(enCola(siguiente.id, filtro, { guardado: "1" }));
    }
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
  const siguiente = await siguienteDe(a, id, filtro);
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
  // Si no hay nada que contar (avisar a mano, advertencias), se sigue con el siguiente pendiente sin parar
  const sinNovedades = (aviso.tipo === "ninguno" || aviso.tipo === "whatsapp-enviado") && resultado.avisos.length === 0;
  if (sinNovedades && siguiente && siguiente.id !== id) redirect(enCola(siguiente.id, filtro, { publicado: r.slug }));
  (await cookies()).set(COOKIE_PUBLICADO, JSON.stringify(resultado), { httpOnly: true, sameSite: "strict", path: "/admin", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  redirect(`/admin/publicado/${r.slug}`);
}

/** Publica los pendientes dados. Deja los que necesitan mirarse uno a uno (duplicados, email de aviso, errores) y guarda el resultado en una cookie. */
async function publicarIds(a: Almacen, ids: string[]) {
  const ocupados = new Set((await todosLosEventos()).map((e) => e.slug));
  const omitidos: Omitido[] = [];
  const avisar: ResultadoLote["avisar"] = [];
  const cfg = configWhatsApp();
  let publicados = 0;

  for (const id of ids) {
    const p = await a.pendiente(id);
    if (!p) continue;
    const titulo = p.evento.titulo || id;
    const r = prepararPublicacion(p, (s) => ocupados.has(s), slugLibre);
    if (!r.ok) {
      omitidos.push({ titulo, motivo: r.motivo });
      continue;
    }
    try {
      const pub = await a.publicar(id, r.evento);
      ocupados.add(pub.slug);
      publicados++;
      if (pub.contacto?.canal === "whatsapp") {
        const url = `${SITIO.url}/evento/${pub.slug}`;
        try {
          if (!cfg) throw new Error("WhatsApp sin configurar");
          await clienteWhatsApp(cfg).avisarPublicado(pub.contacto.valor, url, r.evento.titulo);
        } catch (err) {
          console.error("[admin] aviso por WhatsApp:", err);
          avisar.push({ titulo: r.evento.titulo, numero: pub.contacto.valor, url });
        }
      }
      // El contacto solo servía para el aviso: se borra
      if (pub.contacto) await a.olvidarContacto(a.tipo === "local" ? pub.slug : id);
    } catch (err) {
      console.error("[admin] no se pudo publicar", id, err);
      omitidos.push({ titulo, motivo: "ha fallado al guardarlo: inténtalo desde su ficha" });
    }
  }
  if (publicados) updateTag(ETIQUETA_EVENTOS);

  const resultado: ResultadoLote = { publicados, omitidos, avisar };
  (await cookies()).set(COOKIE_LOTE, JSON.stringify(resultado), { httpOnly: true, sameSite: "strict", path: "/admin", maxAge: 600, secure: process.env.NODE_ENV === "production" });
}

/** Vuelve a la lista con el mismo filtro (solo valores simples) */
function volverALista(f: FormData, extra: Record<string, string>): never {
  const q = new URLSearchParams(consultaFiltro(filtroDe(f)).slice(1));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  redirect(q.size ? `/admin?${q}` : "/admin");
}

/** Publica a la vez los pendientes marcados */
export async function publicarVarios(f: FormData) {
  await exigirAdmin();
  await publicarIds(almacen(), [...new Set(f.getAll("ids").map(String))].slice(0, 100));
  volverALista(f, { lote: "1" });
}

/** Publica de un clic los pendientes que cumplen las reglas de data/reglas.json. Se recalculan aquí: no se fía de lo que traiga el formulario. */
export async function publicarFiables(f: FormData) {
  await exigirAdmin();
  const a = almacen();
  const fiables = await fiablesAhora(a, await a.pendientes());
  await publicarIds(a, fiables.slice(0, 100).map((p) => p.id));
  volverALista(f, { lote: "1" });
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
  volverALista(f, { descartados: String(n) });
}

export async function descartar(id: string, f: FormData) {
  await exigirAdmin();
  const a = almacen();
  const filtro = filtroDe(f);
  const siguiente = await siguienteDe(a, id, filtro);
  await a.descartar(id);
  // Se sigue con el siguiente pendiente de la cola; si no queda ninguno, a la lista
  if (siguiente && siguiente.id !== id) redirect(enCola(siguiente.id, filtro, { descartado: "1" }));
  volverALista(f, { descartado: "1" });
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

  const tabla = tablaCon(await lugaresHabituales(a));
  const { evento, errores, guardarLugares } = formularioAEvento(f, actual.evento, tabla);
  if (errores.length) return { tipo: "errores", errores };
  await guardarHabituales(a, guardarLugares);
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
