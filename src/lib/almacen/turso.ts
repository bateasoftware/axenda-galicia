// Almacén en Turso (libSQL/SQLite). Los carteles se guardan en la propia base de datos (tabla carteles)
// y se sirven en /cartel/<id>.jpg; opcionalmente, en Vercel Blob si está BLOB_READ_WRITE_TOKEN.
// Misma interfaz y mismo formato de datos que Supabase: el evento completo va en "datos" (JSON),
// así que migrar es copiar filas (npm run migrar-a-supabase).
import { randomUUID } from "node:crypto";
import type { Client, InArgs, InStatement, Row } from "@libsql/client";
import { primerInicio } from "../fechas";
import { EventoSchema, type Evento, type EventoBorrador } from "../tipos";
import { limpiarSlug, slugLibre } from "./local";
import type { Almacen, ClaveOrigen, Contacto, ImagenCartel, NuevoPendiente, Pendiente, RegistroCobertura } from "./tipos";

/** El mismo esquema que turso/esquema.sql; se aplica solo la primera vez (es idempotente) */
export const ESQUEMA_TURSO = `
CREATE TABLE IF NOT EXISTS eventos (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'publicado', 'descartado')),
  datos       TEXT NOT NULL,
  id_fuente   TEXT GENERATED ALWAYS AS (json_extract(datos, '$.fuente.id_fuente')) VIRTUAL,
  uid         TEXT GENERATED ALWAYS AS (json_extract(datos, '$.fuente.uid')) VIRTUAL,
  hash        TEXT,
  cartel_url  TEXT,
  duplicados  TEXT NOT NULL DEFAULT '[]',
  creado      TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  publicado   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS eventos_slug_publicado ON eventos (slug) WHERE estado = 'publicado';
CREATE INDEX IF NOT EXISTS eventos_estado ON eventos (estado, creado);
CREATE INDEX IF NOT EXISTS eventos_hash ON eventos (hash);
CREATE INDEX IF NOT EXISTS eventos_origen ON eventos (id_fuente, uid);
CREATE TABLE IF NOT EXISTS carteles (
  id     TEXT PRIMARY KEY,
  tipo   TEXT NOT NULL,
  datos  BLOB NOT NULL,
  creado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contactos (
  evento_id TEXT PRIMARY KEY,
  canal     TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email')),
  valor     TEXT NOT NULL,
  creado    TEXT NOT NULL
);
`;

/** Sube un cartel y devuelve su URL pública */
export type SubirCartel = (ruta: string, cartel: ImagenCartel) => Promise<string>;

/** Carteles en Vercel Blob (BLOB_READ_WRITE_TOKEN). El sufijo aleatorio hace la URL imposible de adivinar. */
export function subirCartelBlob(token: string): SubirCartel {
  return async (ruta, cartel) => {
    const { put } = await import("@vercel/blob");
    const r = await put(ruta, cartel.datos, { access: "public", contentType: cartel.tipo, addRandomSuffix: true, token });
    return r.url;
  };
}

export function tursoConfigurado(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.TURSO_DATABASE_URL;
}

/** Ruta pública de un cartel guardado en Turso */
export const rutaCartelTurso = (id: string, tipo: ImagenCartel["tipo"]) => `/cartel/${id}.${EXT[tipo]}`;

/** Cliente HTTP de Turso (sin módulos nativos: funciona igual en Vercel y en local) */
export async function clienteTurso(env: Record<string, string | undefined> = process.env): Promise<Client> {
  const { createClient } = await import("@libsql/client/web");
  return createClient({ url: env.TURSO_DATABASE_URL!, authToken: env.TURSO_AUTH_TOKEN });
}

type FilaEvento = {
  id: string;
  slug: string;
  estado: RegistroCobertura["estado"];
  datos: string;
  hash: string | null;
  cartel_url: string | null;
  duplicados: string;
  creado: string;
  actualizado: string;
  publicado: string | null;
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const CAMPOS = "id, slug, estado, datos, hash, cartel_url, duplicados, creado, actualizado, publicado";
const aFila = (r: Row) => r as unknown as FilaEvento;

export function almacenTurso({ cliente, subirCartel }: { cliente: () => Promise<Client>; subirCartel?: SubirCartel }): Almacen & {
  /** Todo (eventos y contactos), para migrar a otro almacén */
  exportar(): Promise<{ eventos: FilaEvento[]; contactos: { evento_id: string; canal: Contacto["canal"]; valor: string; creado: string }[] }>;
  /** Un cartel guardado en la base de datos (para servirlo en /cartel/<id>) */
  cartel(id: string): Promise<{ tipo: string; datos: Uint8Array } | null>;
} {
  let listo: Promise<Client> | null = null;
  // Conecta y crea las tablas la primera vez
  const db = () =>
    (listo ??= cliente().then(async (c) => {
      await c.executeMultiple(ESQUEMA_TURSO);
      return c;
    }));
  const consulta = async (sql: string, args: InArgs = []) =>
    (await (await db()).execute({ sql, args })).rows.map(aFila);

  async function contactoDe(id: string): Promise<Contacto | undefined> {
    const [c] = (await (await db()).execute({ sql: "SELECT canal, valor FROM contactos WHERE evento_id = ?", args: [id] })).rows;
    return c ? { canal: c.canal as Contacto["canal"], valor: String(c.valor) } : undefined;
  }

  const aPendiente = (f: FilaEvento, contacto?: Contacto): Pendiente => ({
    id: f.id,
    evento: JSON.parse(f.datos) as EventoBorrador,
    cartel: f.cartel_url ?? undefined,
    hash: f.hash ?? undefined,
    duplicados: JSON.parse(f.duplicados || "[]"),
    contacto,
    creado: f.creado,
  });
  const ahora = () => new Date().toISOString();

  return {
    tipo: "turso",

    async pendientes() {
      return (await consulta(`SELECT ${CAMPOS} FROM eventos WHERE estado = 'pendiente' ORDER BY creado DESC LIMIT 500`)).map((f) => aPendiente(f));
    },

    async pendiente(id) {
      const [f] = await consulta(`SELECT ${CAMPOS} FROM eventos WHERE id = ? AND estado = 'pendiente'`, [id]);
      return f ? aPendiente(f, await contactoDe(id)) : null;
    },

    async publicados() {
      const eventos: Evento[] = [];
      for (const f of await consulta(`SELECT datos FROM eventos WHERE estado = 'publicado'`)) {
        // Se validó al publicar; si alguien lo rompe editando la base de datos a mano, se omite
        const r = EventoSchema.safeParse(JSON.parse(f.datos));
        if (r.success) eventos.push(r.data);
        else console.error("[turso] evento publicado no válido, se omite:", f.datos.slice(0, 80));
      }
      return eventos;
    },

    async yaVisto({ hash, id_fuente, uid }: ClaveOrigen) {
      if (hash && (await consulta("SELECT id FROM eventos WHERE hash = ? LIMIT 1", [hash])).length) return true;
      if (id_fuente && uid) return (await consulta("SELECT id FROM eventos WHERE id_fuente = ? AND uid = ? LIMIT 1", [id_fuente, uid])).length > 0;
      return false;
    },

    async crear({ evento, cartel, hash, contacto, duplicados = [] }: NuevoPendiente) {
      const id = randomUUID();
      const slug = limpiarSlug(evento.slug, `evento-${evento.fuente.recibido.slice(0, 10)}`);
      // Con Vercel Blob, el cartel se sube primero (si falla, no queda un pendiente a medias);
      // sin él, va en la tabla carteles en la misma transacción que el evento
      const cartelUrl = !cartel ? null : subirCartel ? await subirCartel(`carteles/${id}.${EXT[cartel.tipo]}`, cartel) : rutaCartelTurso(id, cartel.tipo);
      const t = ahora();
      const sentencias: InStatement[] = [];
      if (cartel && !subirCartel)
        sentencias.push({ sql: "INSERT INTO carteles (id, tipo, datos, creado) VALUES (?, ?, ?, ?)", args: [id, cartel.tipo, cartel.datos, t] });
      sentencias.push(
        {
          sql: "INSERT INTO eventos (id, slug, estado, datos, hash, cartel_url, duplicados, creado, actualizado) VALUES (?, ?, 'pendiente', ?, ?, ?, ?, ?, ?)",
          args: [id, slug, JSON.stringify({ ...evento, slug }), hash ?? null, cartelUrl, JSON.stringify(duplicados), t, t],
        });
      if (contacto) sentencias.push({ sql: "INSERT INTO contactos (evento_id, canal, valor, creado) VALUES (?, ?, ?, ?)", args: [id, contacto.canal, contacto.valor, t] });
      await (await db()).batch(sentencias, "write");
      return {
        id,
        evento: { ...evento, slug },
        cartel: cartelUrl ?? undefined,
        hash,
        duplicados,
        contacto,
        creado: t,
      };
    },

    async guardar(id, evento) {
      await consulta("UPDATE eventos SET datos = ?, slug = ?, actualizado = ? WHERE id = ? AND estado = 'pendiente'", [JSON.stringify(evento), evento.slug, ahora(), id]);
    },

    async publicar(id, evento) {
      const [f] = await consulta(`SELECT ${CAMPOS} FROM eventos WHERE id = ?`, [id]);
      if (!f) throw new Error(`No existe el pendiente ${id}`);
      const ocupados = new Set((await consulta("SELECT slug FROM eventos WHERE estado = 'publicado' AND id != ?", [id])).map((x) => x.slug));
      const slug = slugLibre(evento.slug, (s) => ocupados.has(s));
      const datos: Evento = { ...evento, slug, ...(f.cartel_url ? { cartel: f.cartel_url } : {}) };
      const t = ahora();
      await consulta("UPDATE eventos SET estado = 'publicado', slug = ?, datos = ?, publicado = ?, actualizado = ? WHERE id = ?", [slug, JSON.stringify(datos), t, t, id]);
      return { slug, contacto: await contactoDe(id) };
    },

    async descartar(id) {
      await (await db()).batch(
        [
          { sql: "UPDATE eventos SET estado = 'descartado', actualizado = ? WHERE id = ?", args: [ahora(), id] },
          { sql: "DELETE FROM contactos WHERE evento_id = ?", args: [id] },
          // El cartel de lo descartado no se publica nunca: fuera
          { sql: "DELETE FROM carteles WHERE id = ?", args: [id] },
        ],
        "write",
      );
    },

    async marcarDuplicados(id, duplicados) {
      await consulta("UPDATE eventos SET duplicados = ? WHERE id = ?", [JSON.stringify(duplicados), id]);
    },

    async olvidarContacto(id) {
      await consulta("DELETE FROM contactos WHERE evento_id = ?", [id]);
    },

    async cobertura() {
      return (await consulta("SELECT estado, datos FROM eventos")).map((f) => {
        const e = JSON.parse(f.datos) as EventoBorrador;
        return {
          estado: f.estado,
          canal: e.fuente.canal,
          id_fuente: e.fuente.id_fuente,
          concello: e.concello,
          inicio: e.sesiones?.length ? primerInicio(e as Evento) : undefined,
          recibido: e.fuente.recibido,
        };
      });
    },

    async cartel(id) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return null;
      const [c] = (await (await db()).execute({ sql: "SELECT tipo, datos FROM carteles WHERE id = ?", args: [id] })).rows;
      return c ? { tipo: String(c.tipo), datos: new Uint8Array(c.datos as ArrayBuffer) } : null;
    },

    async exportar() {
      const eventos = await consulta(`SELECT ${CAMPOS} FROM eventos ORDER BY creado`);
      const contactos = (await (await db()).execute("SELECT evento_id, canal, valor, creado FROM contactos")).rows.map((r) => ({
        evento_id: String(r.evento_id),
        canal: r.canal as Contacto["canal"],
        valor: String(r.valor),
        creado: String(r.creado),
      }));
      return { eventos, contactos };
    },
  };
}
