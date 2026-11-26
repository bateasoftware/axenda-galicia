// Almacén en Supabase (tablas de supabase/esquema.sql y bucket "carteles" de Storage).
// Usa la API REST (PostgREST) con la clave de servicio: solo en el servidor o en scripts, nunca en el cliente.
import { randomUUID } from "node:crypto";
import { primerInicio } from "../fechas";
import { claveLugar, type LugarConocido } from "../lugares";
import { EventoSchema, type Evento, type EventoBorrador } from "../tipos";
import { limpiarSlug, slugLibre } from "./local";
import type { Almacen, ClaveOrigen, Contacto, NuevoPendiente, Pendiente, RegistroCobertura } from "./tipos";

export class ErrorSupabase extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(`Supabase ${estado}: ${mensaje}`);
  }
}

type Fila = {
  id: string;
  slug: string;
  estado: "pendiente" | "publicado" | "descartado";
  datos: EventoBorrador;
  hash: string | null;
  cartel_path: string | null;
  duplicados: string[] | null;
  creado: string;
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const BUCKET = "carteles";

export function supabaseConfigurado(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function almacenSupabase({ url, clave }: { url: string; clave: string }): Almacen {
  const base = url.replace(/\/$/, "");
  // cartel_path es una ruta del bucket o, en lo migrado desde Turso, la URL completa de Vercel Blob
  const urlPublica = (ruta: string) => (ruta.startsWith("https://") ? ruta : `${base}/storage/v1/object/public/${BUCKET}/${ruta}`);
  // Claves antiguas (JWT "service_role") van también como Bearer; las nuevas (sb_secret_…) solo como apikey
  const claves: Record<string, string> = { apikey: clave, ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}) };

  async function rest<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}/rest/v1/${ruta}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...claves,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...init.headers,
      },
    });
    if (!res.ok) throw new ErrorSupabase(res.status, (await res.text()).slice(0, 300));
    return (res.status === 204 ? [] : await res.json()) as T;
  }

  const eq = (v: string) => `eq.${encodeURIComponent(v)}`;
  const CAMPOS = "id,slug,estado,datos,hash,cartel_path,duplicados,creado";

  async function contactoDe(id: string): Promise<Contacto | undefined> {
    const filas = await rest<{ canal: Contacto["canal"]; valor: string }[]>(`contactos?evento_id=${eq(id)}&select=canal,valor`);
    return filas[0];
  }

  const aPendiente = (f: Fila, contacto?: Contacto): Pendiente => ({
    id: f.id,
    evento: f.datos,
    cartel: f.cartel_path ? urlPublica(f.cartel_path) : undefined,
    hash: f.hash ?? undefined,
    duplicados: f.duplicados ?? [],
    contacto,
    creado: f.creado,
  });

  return {
    tipo: "supabase",

    async pendientes() {
      const filas = await rest<Fila[]>(`eventos?estado=eq.pendiente&select=${CAMPOS}&order=creado.desc&limit=500`);
      return filas.map((f) => aPendiente(f));
    },

    async pendiente(id) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return null;
      const [f] = await rest<Fila[]>(`eventos?id=${eq(id)}&estado=eq.pendiente&select=${CAMPOS}`);
      return f ? aPendiente(f, await contactoDe(id)) : null;
    },

    async publicados() {
      const filas = await rest<{ datos: unknown }[]>(`eventos?estado=eq.publicado&select=datos&limit=5000`);
      const eventos: Evento[] = [];
      for (const f of filas) {
        // Lo publicado se validó al publicar; si alguien lo edita a mano en Supabase y lo rompe, se omite
        const r = EventoSchema.safeParse(f.datos);
        if (r.success) eventos.push(r.data);
        else console.error("[supabase] evento publicado no válido, se omite:", (f.datos as { slug?: string })?.slug);
      }
      return eventos;
    },

    async yaVisto({ hash, id_fuente, uid }: ClaveOrigen) {
      if (hash && (await rest<unknown[]>(`eventos?hash=${eq(hash)}&select=id&limit=1`)).length) return true;
      if (id_fuente && uid)
        return (await rest<unknown[]>(`eventos?id_fuente=${eq(id_fuente)}&uid=${eq(uid)}&select=id&limit=1`)).length > 0;
      return false;
    },

    async crear({ evento, cartel, hash, contacto, duplicados = [] }: NuevoPendiente) {
      const slug = limpiarSlug(evento.slug, `evento-${evento.fuente.recibido.slice(0, 10)}`);
      const [fila] = await rest<Fila[]>(`eventos?select=${CAMPOS}`, {
        method: "POST",
        body: JSON.stringify({ slug, estado: "pendiente", datos: { ...evento, slug }, hash: hash ?? null, duplicados }),
      });
      if (cartel) {
        const ruta = `${fila.id}.${EXT[cartel.tipo]}`;
        const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${ruta}`, {
          method: "POST",
          headers: { ...claves, "Content-Type": cartel.tipo, "x-upsert": "true" },
          body: new Uint8Array(cartel.datos),
        });
        if (!res.ok) throw new ErrorSupabase(res.status, `Storage: ${(await res.text()).slice(0, 200)}`);
        await rest(`eventos?id=${eq(fila.id)}`, { method: "PATCH", body: JSON.stringify({ cartel_path: ruta }) });
        fila.cartel_path = ruta;
      }
      if (contacto) await rest(`contactos`, { method: "POST", body: JSON.stringify({ evento_id: fila.id, ...contacto }) });
      return aPendiente(fila, contacto);
    },

    async guardar(id, evento) {
      await rest(`eventos?id=${eq(id)}&estado=eq.pendiente`, {
        method: "PATCH",
        body: JSON.stringify({ datos: evento, slug: evento.slug, actualizado: new Date().toISOString() }),
      });
    },

    async publicar(id, evento) {
      const [f] = await rest<Fila[]>(`eventos?id=${eq(id)}&select=${CAMPOS}`);
      if (!f) throw new Error(`No existe el pendiente ${id}`);
      // El slug lo elige quien llama (libre entre todos los publicados); aquí solo se comprueba Supabase
      const ocupados = new Set(
        (await rest<{ slug: string }[]>(`eventos?estado=eq.publicado&id=neq.${id}&select=slug`)).map((x) => x.slug),
      );
      const slug = slugLibre(evento.slug, (s) => ocupados.has(s));
      const datos: Evento = { ...evento, slug, ...(f.cartel_path ? { cartel: urlPublica(f.cartel_path) } : {}) };
      const ahora = new Date().toISOString();
      await rest(`eventos?id=${eq(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "publicado", slug, datos, publicado: ahora, actualizado: ahora }),
      });
      return { slug, contacto: await contactoDe(id) };
    },

    async descartar(id) {
      await rest(`eventos?id=${eq(id)}`, { method: "PATCH", body: JSON.stringify({ estado: "descartado", actualizado: new Date().toISOString() }) });
      // Lo descartado no necesita el contacto ni el cartel
      await rest(`contactos?evento_id=${eq(id)}`, { method: "DELETE" });
    },

    async publicadosConId() {
      const filas = await rest<{ id: string; datos: unknown }[]>(`eventos?estado=eq.publicado&select=id,datos&order=publicado.desc&limit=5000`);
      return filas.flatMap((f) => {
        const r = EventoSchema.safeParse(f.datos);
        return r.success ? [{ id: f.id, evento: r.data }] : [];
      });
    },

    async publicado(id) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return null;
      const [f] = await rest<{ id: string; datos: unknown }[]>(`eventos?id=${eq(id)}&estado=eq.publicado&select=id,datos`);
      const r = f && EventoSchema.safeParse(f.datos);
      return r && r.success ? { id, evento: r.data } : null;
    },

    async guardarPublicado(id, evento) {
      await rest(`eventos?id=${eq(id)}&estado=eq.publicado`, { method: "PATCH", body: JSON.stringify({ datos: evento, actualizado: new Date().toISOString() }) });
    },

    async retirar(id) {
      const [f] = await rest<{ datos: Record<string, unknown> }[]>(`eventos?id=${eq(id)}&select=datos`);
      if (!f) return;
      // "_retirado" oculta también un evento de data/eventos con el mismo slug
      await rest(`eventos?id=${eq(id)}`, { method: "PATCH", body: JSON.stringify({ estado: "descartado", datos: { ...f.datos, _retirado: true }, actualizado: new Date().toISOString() }) });
      await rest(`contactos?evento_id=${eq(id)}`, { method: "DELETE" });
    },

    async adoptar(evento) {
      const ahora = new Date().toISOString();
      const [f] = await rest<{ id: string }[]>(`eventos?select=id`, {
        method: "POST",
        body: JSON.stringify({ slug: evento.slug, estado: "publicado", datos: evento, cartel_path: evento.cartel ?? null, publicado: ahora }),
      });
      return { id: f.id };
    },

    async retirarSlug(slug) {
      await rest(`eventos`, { method: "POST", body: JSON.stringify({ slug, estado: "descartado", datos: { slug, _retirado: true } }) });
    },

    async slugsRetirados() {
      return (await rest<{ slug: string }[]>(`eventos?estado=eq.descartado&datos->>_retirado=eq.true&select=slug`)).map((f) => f.slug);
    },

    async ponerCartel(id, cartel, estado) {
      const [f] = await rest<{ datos: Record<string, unknown> }[]>(`eventos?id=${eq(id)}&estado=eq.${estado}&select=datos`);
      if (!f) throw new Error(`No existe el evento ${id}`);
      // Cartel nuevo = ruta nueva (la anterior podría estar en la caché de las imágenes)
      const ruta = `${randomUUID()}.${EXT[cartel.tipo]}`;
      const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${ruta}`, {
        method: "POST",
        headers: { ...claves, "Content-Type": cartel.tipo, "x-upsert": "true" },
        body: new Uint8Array(cartel.datos),
      });
      if (!res.ok) throw new ErrorSupabase(res.status, `Storage: ${(await res.text()).slice(0, 200)}`);
      const url = urlPublica(ruta);
      await rest(`eventos?id=${eq(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ cartel_path: ruta, ...(estado === "publicado" ? { datos: { ...f.datos, cartel: url } } : {}), actualizado: new Date().toISOString() }),
      });
      return url;
    },

    async marcarDuplicados(id, duplicados) {
      await rest(`eventos?id=${eq(id)}`, { method: "PATCH", body: JSON.stringify({ duplicados }) });
    },

    async olvidarContacto(id) {
      await rest(`contactos?evento_id=${eq(id)}`, { method: "DELETE" });
    },

    async lugares() {
      const filas = await rest<{ nombre: string; concello: string; parroquia: string | null; direccion: string | null; lat: number; lng: number; aprox: boolean }[]>(
        "lugares?select=nombre,concello,parroquia,direccion,lat,lng,aprox&order=concello,nombre&limit=5000",
      );
      return filas.map((r): LugarConocido => ({ nombre: r.nombre, concello: r.concello, ...(r.parroquia ? { parroquia: r.parroquia } : {}), ...(r.direccion ? { direccion: r.direccion } : {}), lat: r.lat, lng: r.lng, ...(r.aprox ? { aprox: true } : {}) }));
    },

    async guardarLugar(l, anterior) {
      if (anterior && claveLugar(anterior.nombre, anterior.concello) !== claveLugar(l.nombre, l.concello))
        await rest(`lugares?clave=${eq(claveLugar(anterior.nombre, anterior.concello))}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await rest("lugares", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ clave: claveLugar(l.nombre, l.concello), nombre: l.nombre, concello: l.concello, parroquia: l.parroquia ?? null, direccion: l.direccion ?? null, lat: l.lat, lng: l.lng, aprox: !!l.aprox, actualizado: new Date().toISOString() }),
      });
    },

    async borrarLugar(nombre, concello) {
      await rest(`lugares?clave=${eq(claveLugar(nombre, concello))}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    },

    async cobertura() {
      const filas = await rest<{ estado: RegistroCobertura["estado"]; datos: EventoBorrador }[]>(`eventos?select=estado,datos&limit=10000`);
      return filas
        .filter(({ datos: e }) => e.fuente) // las marcas de "oculto" de un evento de git no son eventos
        .map(({ estado, datos: e }) => ({
          estado,
          canal: e.fuente.canal,
          id_fuente: e.fuente.id_fuente,
          concello: e.concello,
          inicio: e.sesiones?.length ? primerInicio(e as Evento) : undefined,
          recibido: e.fuente.recibido,
        }));
    },
  };
}

/** Fila tal como la exporta otro almacén (Turso), para migrar */
export type FilaMigracion = {
  id: string;
  slug: string;
  estado: "pendiente" | "publicado" | "descartado";
  datos: string;
  hash: string | null;
  cartel_url: string | null;
  duplicados: string;
  creado: string;
  actualizado: string;
  publicado: string | null;
};

/**
 * Copia eventos y contactos a Supabase conservando ids, estados y fechas. Se puede repetir: actualiza lo que ya está.
 * Los carteles se quedan en Vercel Blob (su URL completa va en cartel_path).
 */
export async function importarEnSupabase(
  { url, clave }: { url: string; clave: string },
  eventos: FilaMigracion[],
  contactos: { evento_id: string; canal: "whatsapp" | "email"; valor: string; creado: string }[],
  /** Lee un cartel guardado en la base de datos de origen (los "/cartel/<id>.jpg" de Turso) */
  leerCartel?: (id: string) => Promise<{ tipo: string; datos: Uint8Array } | null>,
) {
  const base = url.replace(/\/$/, "");
  // Carteles guardados dentro de Turso → bucket "carteles" de Supabase
  const nuevaUrl = new Map<string, string>();
  for (const e of eventos) {
    const m = e.cartel_url?.match(/^\/cartel\/([0-9a-f-]{36})\.(jpg|png|webp)$/);
    if (!m || !leerCartel) continue;
    const c = await leerCartel(m[1]);
    if (!c) continue;
    const ruta = `${m[1]}.${m[2]}`;
    const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: "POST",
      headers: { apikey: clave, ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}), "Content-Type": c.tipo, "x-upsert": "true" },
      body: c.datos as BodyInit,
    });
    if (!res.ok) throw new ErrorSupabase(res.status, `Storage: ${(await res.text()).slice(0, 200)}`);
    nuevaUrl.set(e.id, ruta);
  }
  const cabeceras: Record<string, string> = {
    apikey: clave,
    ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}),
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  };
  const enviar = async (tabla: string, filas: unknown[]) => {
    for (let i = 0; i < filas.length; i += 200) {
      const res = await fetch(`${base}/rest/v1/${tabla}`, { method: "POST", headers: cabeceras, body: JSON.stringify(filas.slice(i, i + 200)) });
      if (!res.ok) throw new ErrorSupabase(res.status, (await res.text()).slice(0, 300));
    }
  };
  await enviar(
    "eventos",
    eventos.map((e) => {
      const ruta = nuevaUrl.get(e.id);
      const datos = JSON.parse(e.datos);
      // Lo publicado lleva la URL del cartel dentro de "datos": se cambia a la de Supabase
      if (ruta && datos.cartel) datos.cartel = `${base}/storage/v1/object/public/${BUCKET}/${ruta}`;
      return {
        id: e.id,
        slug: e.slug,
        estado: e.estado,
        datos,
        hash: e.hash,
        cartel_path: ruta ?? e.cartel_url,
        duplicados: JSON.parse(e.duplicados || "[]"),
        creado: e.creado,
        actualizado: e.actualizado,
        publicado: e.publicado,
      };
    }),
  );
  await enviar("contactos", contactos);
}
