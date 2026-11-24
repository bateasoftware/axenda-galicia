"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { almacen, slugLibre } from "@/lib/almacen";
import { formularioAEvento } from "@/lib/admin/formulario";
import { COOKIE_PUBLICADO, type ResultadoPublicacion } from "@/lib/admin/publicacion";
import { abrirSesion, cerrarSesion, claveCorrecta, exigirAdmin } from "@/lib/admin/sesion";
import { ETIQUETA_EVENTOS, todosLosEventos } from "@/lib/eventos";
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

export type EstadoRevision = { tipo: "inicial" } | { tipo: "errores"; errores: string[] } | { tipo: "guardado"; avisos: string[] };

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

export async function descartar(id: string) {
  await exigirAdmin();
  await almacen().descartar(id);
  redirect("/admin?descartado=1");
}
