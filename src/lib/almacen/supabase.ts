// Almacén en Supabase (tablas de supabase/esquema.sql y bucket "carteles" de Storage).
// Usa la API REST (PostgREST) con la clave de servicio: solo en el servidor o en scripts, nunca en el cliente.
import { primerInicio } from "../fechas";
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

    async marcarDuplicados(id, duplicados) {
      await rest(`eventos?id=${eq(id)}`, { method: "PATCH", body: JSON.stringify({ duplicados }) });
    },

    async olvidarContacto(id) {
      await rest(`contactos?evento_id=${eq(id)}`, { method: "DELETE" });
    },

    async cobertura() {
      const filas = await rest<{ estado: RegistroCobertura["estado"]; datos: EventoBorrador }[]>(`eventos?select=estado,datos&limit=10000`);
      return filas.map(({ estado, datos: e }) => ({
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
) {
  const base = url.replace(/\/$/, "");
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
    eventos.map((e) => ({
      id: e.id,
      slug: e.slug,
      estado: e.estado,
      datos: JSON.parse(e.datos),
      hash: e.hash,
      cartel_path: e.cartel_url,
      duplicados: JSON.parse(e.duplicados || "[]"),
      creado: e.creado,
      actualizado: e.actualizado,
      publicado: e.publicado,
    })),
  );
  await enviar("contactos", contactos);
}
