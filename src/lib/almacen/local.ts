// Solo se usa en local (en Vercel el almacén es Turso o Supabase): las rutas no se rastrean en el build (turbopackIgnore).
// Almacén en ficheros (desarrollo y scripts). Formato compatible con `npm run extraer`:
//   data/pendientes/<id>.json        evento + campos internos (_imagen, _cartel, _hash, _duplicados, _creado)
//   data/pendientes/carteles/<id>.*  cartel de los pendientes que no vienen de data/entrada
//   data/pendientes/.privado/<id>.json  contacto de quien lo envía (fuera de git)
//   data/descartados.json            lo descartado, para no volver a importarlo (sin datos personales)
import fs from "node:fs";
import path from "node:path";
import { primerInicio } from "../fechas";
import { claveLugar, type LugarConocido, type TablaLugares } from "../lugares";
import type { Evento, EventoBorrador } from "../tipos";
import { sinCamposInternos } from "../validacion";
import type { Almacen, ClaveOrigen, Contacto, NuevoPendiente, Pendiente, RegistroCobertura } from "./tipos";

type Descartado = {
  titulo: string;
  concello: string;
  canal: EventoBorrador["fuente"]["canal"];
  id_fuente?: string;
  uid?: string;
  hash?: string;
  recibido: string;
  inicio?: string;
  descartado: string;
};

const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export function limpiarSlug(propuesto: string, respaldo = "evento"): string {
  const s = propuesto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
  return s || respaldo;
}

/** Primer slug libre añadiendo -2, -3… */
export function slugLibre(slug: string, ocupado: (s: string) => boolean): string {
  if (!ocupado(slug)) return slug;
  let n = 2;
  while (ocupado(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

export function almacenLocal(raiz = process.cwd()): Almacen {
  const PEND = path.join(raiz, "data", "pendientes");
  const CARTELES_PEND = path.join(PEND, "carteles");
  const PRIVADO = path.join(PEND, ".privado");
  const EVENTOS = path.join(raiz, "data", "eventos");
  const ENTRADA = path.join(raiz, "data", "entrada");
  const PUBLICOS = path.join(raiz, "public", "carteles");
  const DESCARTADOS = path.join(raiz, "data", "descartados.json");
  // En local, los lugares habituales son la propia semilla (git es el CMS)
  const LUGARES = path.join(raiz, "data", "lugares.json");
  const tablaLugares = () => leerJSON(LUGARES) as TablaLugares;
  const escribirLugares = (lugares: LugarConocido[]) => {
    const t = tablaLugares();
    const ordenados = [...lugares].sort((a, b) => a.concello.localeCompare(b.concello) || a.nombre.localeCompare(b.nombre));
    fs.writeFileSync(/*turbopackIgnore: true*/ LUGARES, JSON.stringify({ ...t, lugares: ordenados }, null, 2) + "\n");
  };

  const leerJSON = (f: string) => JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ f, "utf8"));
  const descartados = (): Descartado[] => (fs.existsSync(/*turbopackIgnore: true*/ DESCARTADOS) ? leerJSON(DESCARTADOS) : []);
  const ficheroCartel = (crudo: Record<string, unknown>): string | undefined => {
    if (typeof crudo._cartel === "string") return path.join(/*turbopackIgnore: true*/ raiz, crudo._cartel);
    if (typeof crudo._imagen === "string") return path.join(ENTRADA, crudo._imagen);
  };

  function leer(id: string): Pendiente | null {
    const f = path.join(PEND, `${id}.json`);
    if (!/^[a-z0-9-]+$/.test(id) || !fs.existsSync(/*turbopackIgnore: true*/ f)) return null;
    let crudo: Record<string, unknown>;
    try {
      crudo = leerJSON(f);
    } catch {
      return null;
    }
    const privado = path.join(PRIVADO, `${id}.json`);
    const cartel = ficheroCartel(crudo);
    return {
      id,
      evento: sinCamposInternos(crudo) as EventoBorrador,
      // En local el panel sirve el fichero a través de /admin/cartel/<id>
      cartel: cartel && fs.existsSync(/*turbopackIgnore: true*/ cartel) ? `/admin/cartel/${id}` : undefined,
      hash: typeof crudo._hash === "string" ? crudo._hash : undefined,
      duplicados: Array.isArray(crudo._duplicados) ? (crudo._duplicados as string[]) : [],
      contacto: fs.existsSync(/*turbopackIgnore: true*/ privado) ? (leerJSON(privado) as Contacto) : undefined,
      creado: typeof crudo._creado === "string" ? crudo._creado : fs.statSync(/*turbopackIgnore: true*/ f).mtime.toISOString(),
    };
  }

  function escribir(id: string, evento: EventoBorrador, internos: Record<string, unknown>) {
    fs.mkdirSync(/*turbopackIgnore: true*/ PEND, { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ path.join(PEND, `${id}.json`), JSON.stringify({ ...evento, ...internos }, null, 2) + "\n");
  }

  function internosDe(id: string): Record<string, unknown> {
    const crudo = leerJSON(path.join(PEND, `${id}.json`));
    return Object.fromEntries(Object.entries(crudo).filter(([k]) => k.startsWith("_")));
  }

  function borrarPendiente(id: string, { conCartel }: { conCartel: boolean }) {
    const f = path.join(PEND, `${id}.json`);
    const crudo = leerJSON(f);
    const cartel = ficheroCartel(crudo);
    if (conCartel && cartel && fs.existsSync(/*turbopackIgnore: true*/ cartel)) fs.rmSync(/*turbopackIgnore: true*/ cartel);
    fs.rmSync(/*turbopackIgnore: true*/ f);
    fs.rmSync(/*turbopackIgnore: true*/ path.join(PRIVADO, `${id}.json`), { force: true });
  }

  const ids = () => (fs.existsSync(/*turbopackIgnore: true*/ PEND) ? fs.readdirSync(/*turbopackIgnore: true*/ PEND).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)) : []);

  return {
    tipo: "local",

    async pendientes() {
      return ids()
        .map(leer)
        .filter((p): p is Pendiente => p !== null)
        .sort((a, b) => b.creado.localeCompare(a.creado));
    },

    async pendiente(id) {
      return leer(id);
    },

    async publicados() {
      if (!fs.existsSync(/*turbopackIgnore: true*/ EVENTOS)) return [];
      return fs
        .readdirSync(EVENTOS)
        .filter((f) => f.endsWith(".json"))
        .map((f) => leerJSON(path.join(EVENTOS, f)) as Evento);
    },

    async yaVisto({ hash, id_fuente, uid }: ClaveOrigen) {
      const coincide = (h?: unknown, fu?: { id_fuente?: string; uid?: string }) =>
        (hash && h === hash) || (id_fuente && uid && fu?.id_fuente === id_fuente && fu?.uid === uid);
      for (const id of ids()) {
        try {
          const c = leerJSON(path.join(PEND, `${id}.json`));
          if (coincide(c._hash, c.fuente)) return true;
        } catch {
          // pendiente roto: se ignora
        }
      }
      if ((await this.publicados()).some((e) => coincide(undefined, e.fuente))) return true;
      return descartados().some((d) => coincide(d.hash, d));
    },

    async crear({ evento, cartel, hash, contacto, duplicados = [] }: NuevoPendiente) {
      const id = slugLibre(limpiarSlug(evento.slug, `evento-${evento.fuente.recibido.slice(0, 10)}`), (s) =>
        fs.existsSync(/*turbopackIgnore: true*/ path.join(PEND, `${s}.json`)),
      );
      const internos: Record<string, unknown> = { _creado: new Date().toISOString() };
      if (hash) internos._hash = hash;
      if (duplicados.length) internos._duplicados = duplicados;
      if (cartel) {
        fs.mkdirSync(/*turbopackIgnore: true*/ CARTELES_PEND, { recursive: true });
        const rel = path.join("data", "pendientes", "carteles", `${id}${EXT[cartel.tipo]}`);
        fs.writeFileSync(/*turbopackIgnore: true*/ path.join(raiz, rel), cartel.datos);
        internos._cartel = rel;
      }
      escribir(id, { ...evento, slug: id }, internos);
      if (contacto) {
        fs.mkdirSync(/*turbopackIgnore: true*/ PRIVADO, { recursive: true });
        fs.writeFileSync(/*turbopackIgnore: true*/ path.join(PRIVADO, `${id}.json`), JSON.stringify(contacto));
      }
      return leer(id)!;
    },

    async guardar(id, evento) {
      if (!leer(id)) throw new Error(`No existe el pendiente ${id}`);
      escribir(id, evento, internosDe(id));
    },

    async publicar(id, evento) {
      const p = leer(id);
      if (!p) throw new Error(`No existe el pendiente ${id}`);
      const crudo = leerJSON(path.join(PEND, `${id}.json`));
      const origen = ficheroCartel(crudo);
      const publicado: Evento = { ...evento };
      // Primero se escribe todo; solo al final se borra el pendiente
      if (origen && fs.existsSync(/*turbopackIgnore: true*/ origen)) {
        const nombre = `${evento.slug}${path.extname(origen).toLowerCase()}`;
        fs.mkdirSync(/*turbopackIgnore: true*/ PUBLICOS, { recursive: true });
        fs.copyFileSync(/*turbopackIgnore: true*/ origen, path.join(PUBLICOS, nombre));
        publicado.cartel = `/carteles/${nombre}`;
      }
      fs.mkdirSync(/*turbopackIgnore: true*/ EVENTOS, { recursive: true });
      fs.writeFileSync(/*turbopackIgnore: true*/ path.join(EVENTOS, `${evento.slug}.json`), JSON.stringify(publicado, null, 2) + "\n");
      // El contacto se conserva hasta que se avise (olvidarContacto)
      const contacto = p.contacto;
      if (contacto) {
        fs.mkdirSync(/*turbopackIgnore: true*/ PRIVADO, { recursive: true });
        fs.writeFileSync(/*turbopackIgnore: true*/ path.join(PRIVADO, `publicado-${evento.slug}.json`), JSON.stringify(contacto));
      }
      borrarPendiente(id, { conCartel: true });
      return { slug: evento.slug, contacto };
    },

    async descartar(id) {
      const p = leer(id);
      if (!p) return;
      const e = p.evento;
      const lista = descartados();
      lista.push({
        titulo: e.titulo,
        concello: e.concello,
        canal: e.fuente.canal,
        ...(e.fuente.id_fuente ? { id_fuente: e.fuente.id_fuente } : {}),
        ...(e.fuente.uid ? { uid: e.fuente.uid } : {}),
        ...(p.hash ? { hash: p.hash } : {}),
        recibido: e.fuente.recibido,
        ...(e.sesiones[0] ? { inicio: e.sesiones[0].inicio } : {}),
        descartado: new Date().toISOString().slice(0, 10),
      });
      fs.writeFileSync(/*turbopackIgnore: true*/ DESCARTADOS, JSON.stringify(lista, null, 2) + "\n");
      borrarPendiente(id, { conCartel: true });
    },

    async publicadosConId() {
      if (!fs.existsSync(/*turbopackIgnore: true*/ EVENTOS)) return [];
      return fs
        .readdirSync(/*turbopackIgnore: true*/ EVENTOS)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({ id: f.slice(0, -5), evento: leerJSON(path.join(EVENTOS, f)) as Evento }));
    },

    async publicado(id) {
      const f = path.join(EVENTOS, `${id}.json`);
      if (!/^[a-z0-9-]+$/.test(id) || !fs.existsSync(/*turbopackIgnore: true*/ f)) return null;
      return { id, evento: leerJSON(f) as Evento };
    },

    async guardarPublicado(id, evento) {
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error("id no válido");
      fs.writeFileSync(/*turbopackIgnore: true*/ path.join(EVENTOS, `${id}.json`), JSON.stringify({ ...evento, slug: id }, null, 2) + "\n");
    },

    async retirar(id) {
      fs.rmSync(/*turbopackIgnore: true*/ path.join(EVENTOS, `${id}.json`), { force: true });
    },

    // En local los eventos de git son los mismos ficheros: no hay nada que copiar ni ocultar aparte
    async adoptar(evento) {
      return { id: evento.slug };
    },
    async retirarSlug(slug) {
      fs.rmSync(/*turbopackIgnore: true*/ path.join(EVENTOS, `${slug}.json`), { force: true });
    },
    async slugsRetirados() {
      return [];
    },

    async ponerCartel(id, cartel, estado) {
      const nombre = `${id}${EXT[cartel.tipo]}`;
      if (estado === "pendiente") {
        const p = leer(id);
        if (!p) throw new Error(`No existe el pendiente ${id}`);
        const antes = ficheroCartel(leerJSON(path.join(PEND, `${id}.json`)));
        fs.mkdirSync(/*turbopackIgnore: true*/ CARTELES_PEND, { recursive: true });
        const rel = path.join("data", "pendientes", "carteles", nombre);
        fs.writeFileSync(/*turbopackIgnore: true*/ path.join(raiz, rel), cartel.datos);
        if (antes && antes !== path.join(raiz, rel) && antes.startsWith(CARTELES_PEND)) fs.rmSync(/*turbopackIgnore: true*/ antes, { force: true });
        const internos = internosDe(id);
        delete internos._imagen;
        escribir(id, p.evento, { ...internos, _cartel: rel });
        return `/admin/cartel/${id}`;
      }
      const e = await this.publicado(id);
      if (!e) throw new Error(`No existe el evento ${id}`);
      fs.mkdirSync(/*turbopackIgnore: true*/ PUBLICOS, { recursive: true });
      fs.writeFileSync(/*turbopackIgnore: true*/ path.join(PUBLICOS, nombre), cartel.datos);
      await this.guardarPublicado(id, { ...e.evento, cartel: `/carteles/${nombre}` });
      return `/carteles/${nombre}`;
    },

    async marcarDuplicados(id, duplicados) {
      const p = leer(id);
      if (!p) return;
      const internos = internosDe(id);
      if (duplicados.length) internos._duplicados = duplicados;
      else delete internos._duplicados;
      escribir(id, p.evento, internos);
    },

    async olvidarContacto(idOSlug) {
      fs.rmSync(/*turbopackIgnore: true*/ path.join(PRIVADO, `${idOSlug}.json`), { force: true });
      fs.rmSync(/*turbopackIgnore: true*/ path.join(PRIVADO, `publicado-${idOSlug}.json`), { force: true });
    },

    async lugares() {
      return tablaLugares().lugares;
    },

    async guardarLugar(l, anterior) {
      const quitar = new Set([claveLugar(l.nombre, l.concello), ...(anterior ? [claveLugar(anterior.nombre, anterior.concello)] : [])]);
      escribirLugares([...tablaLugares().lugares.filter((x) => !quitar.has(claveLugar(x.nombre, x.concello))), l]);
    },

    async borrarLugar(nombre, concello) {
      escribirLugares(tablaLugares().lugares.filter((x) => claveLugar(x.nombre, x.concello) !== claveLugar(nombre, concello)));
    },

    async cobertura() {
      const reg = (estado: RegistroCobertura["estado"], e: EventoBorrador): RegistroCobertura => ({
        estado,
        canal: e.fuente.canal,
        id_fuente: e.fuente.id_fuente,
        concello: e.concello,
        inicio: e.sesiones?.[0] ? primerInicio(e as Evento) : undefined,
        recibido: e.fuente.recibido,
      });
      return [
        ...(await this.publicados()).map((e) => reg("publicado", e)),
        ...(await this.pendientes()).map((p) => reg("pendiente", p.evento)),
        ...descartados().map(
          (d): RegistroCobertura => ({ estado: "descartado", canal: d.canal, id_fuente: d.id_fuente, concello: d.concello, inicio: d.inicio, recibido: d.recibido }),
        ),
      ];
    },
  };
}
