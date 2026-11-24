// Validación de los datos de /data. Sin "server-only" para que la usen también los scripts.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { EventoSchema, LugaresSchema, type Evento } from "./tipos";

export type Resultado<T> = { ok: true; valor: T; avisos: string[] } | { ok: false; errores: string[]; avisos: string[] };

const UMBRAL_CONFIANZA = 0.8;

function erroresZod(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(raíz)"}: ${i.message}`);
}

/**
 * Valida un evento ya parseado. `raiz` es la carpeta del proyecto, para comprobar que el cartel existe;
 * con `null` no se comprueba (p. ej. cuando el cartel aún va a subirse en un pull request).
 * Los avisos no impiden publicar; los errores sí.
 */
export function validarEvento(datos: unknown, raiz: string | null, nombreFichero?: string): Resultado<Evento> {
  const r = EventoSchema.safeParse(datos);
  if (!r.success) return { ok: false, errores: erroresZod(r.error), avisos: [] };
  const e = r.data;
  const errores: string[] = [];
  const avisos: string[] = [];

  if (nombreFichero && nombreFichero !== `${e.slug}.json`) errores.push(`slug "${e.slug}" no coincide con el fichero ${nombreFichero}`);
  if (raiz && e.cartel && !fs.existsSync(path.join(raiz, "public", e.cartel))) errores.push(`cartel: no existe public${e.cartel}`);

  if (e.confianza < UMBRAL_CONFIANZA) avisos.push(`confianza baja (${e.confianza})`);
  const aprox = e.lugares.filter((l) => l.aprox).map((l) => l.nombre);
  if (aprox.length) avisos.push(`coordenadas aproximadas: ${aprox.join(", ")}`);
  if (e.inferido?.length) avisos.push(`deducido: ${e.inferido.join(", ")}`);
  if (e.sesiones.some((s) => s.inicio.endsWith("T00:00"))) avisos.push("hay una sesión a las 00:00: ¿falta la hora? (si no tiene hora, déjala solo con el día)");

  return errores.length ? { ok: false, errores, avisos } : { ok: true, valor: e, avisos };
}

/** Quita los campos internos del extractor (empiezan por "_", p. ej. "_imagen") */
export function sinCamposInternos(datos: unknown): unknown {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return datos;
  return Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith("_")));
}

/**
 * Lee y valida todos los eventos de una carpeta. Devuelve los válidos y los problemas por fichero.
 * Con `pendientes: true` ignora los campos internos del extractor.
 */
export function leerEventos(dir: string, raiz: string, { pendientes = false } = {}) {
  const eventos: Evento[] = [];
  const problemas: { fichero: string; errores: string[] }[] = [];
  const avisos: { fichero: string; avisos: string[] }[] = [];
  const slugs = new Map<string, string>();

  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    let datos: unknown;
    try {
      datos = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch (err) {
      problemas.push({ fichero: f, errores: [`JSON mal formado: ${(err as Error).message}`] });
      continue;
    }
    const r = validarEvento(pendientes ? sinCamposInternos(datos) : datos, raiz, f);
    if (r.avisos.length) avisos.push({ fichero: f, avisos: r.avisos });
    if (!r.ok) {
      problemas.push({ fichero: f, errores: r.errores });
      continue;
    }
    const previo = slugs.get(r.valor.slug);
    if (previo) {
      problemas.push({ fichero: f, errores: [`slug repetido (también en ${previo})`] });
      continue;
    }
    slugs.set(r.valor.slug, f);
    eventos.push(r.valor);
  }
  return { eventos, problemas, avisos };
}

export function validarLugares(raiz: string): string[] {
  const fichero = path.join(raiz, "data", "lugares.json");
  try {
    const r = LugaresSchema.safeParse(JSON.parse(fs.readFileSync(fichero, "utf8")));
    return r.success ? [] : erroresZod(r.error);
  } catch (err) {
    return [`JSON mal formado: ${(err as Error).message}`];
  }
}

export function formatearProblemas(problemas: { fichero: string; errores: string[] }[]): string {
  return problemas.map((p) => `  ${p.fichero}\n${p.errores.map((e) => `    - ${e}`).join("\n")}`).join("\n");
}
