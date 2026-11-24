// Lo común a todos los canales de entrada (email, formulario, WhatsApp): preparar el archivo
// y elegir dónde se guarda lo recibido.
import { createHash } from "node:crypto";
import { almacen, almacenDisponible, remotoConfigurado } from "./almacen";
import { procesarEntrada, procesarEntradaGitHub, type Entrada, type ResultadoEntrada } from "./entrada";
import { extraer } from "./extraccion";
import { clienteGitHub } from "./github";
import { normalizarCartel } from "./imagen";
import { buscadorDuplicados } from "./duplicados";
import { extraerSinIA } from "./sin-ia";

export class ArchivoNoValido extends Error {}

/** Imagen → JPEG reducido sin metadatos. PDF → tal cual. Hash del fichero original. */
export async function prepararArchivo(datos: Buffer): Promise<{ archivo: NonNullable<Entrada["archivo"]>; hash: string }> {
  if (datos.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { archivo: { datos, tipo: "application/pdf" }, hash: createHash("sha256").update(datos).digest("hex").slice(0, 16) };
  }
  try {
    const { imagen, hash } = await normalizarCartel(datos);
    return { archivo: { datos: imagen, tipo: "image/jpeg" }, hash };
  } catch {
    throw new ArchivoNoValido("El fichero no es una imagen ni un PDF válido.");
  }
}

/**
 * Dónde se guarda lo recibido:
 *  - "almacen": Turso o Supabase si están configurados; en local (fuera de Vercel) sin GitHub, ficheros en data/pendientes
 *  - "github": un pull request por envío (Vercel sin base de datos; necesita la API de Claude)
 *  - null: no hay dónde guardarlo
 * Sin ANTHROPIC_API_KEY también se recibe: se guarda "por completar" para rellenarlo a mano.
 */
export function destinoConfigurado(env: Record<string, string | undefined> = process.env): "almacen" | "github" | null {
  const github = !!(env.GITHUB_TOKEN && env.GITHUB_REPO && env.ANTHROPIC_API_KEY);
  if (remotoConfigurado(env) || (almacenDisponible(env) && !github)) return "almacen";
  return github ? "github" : null;
}

/** ¿Se extraen los datos con la API de Claude (de pago) o se dejan para completarlos a mano? */
export const conIA = (env: Record<string, string | undefined> = process.env) => !!env.ANTHROPIC_API_KEY;

/** Procesa un envío en el destino configurado */
export async function recibir(entrada: Entrada, env: Record<string, string | undefined> = process.env): Promise<ResultadoEntrada> {
  const extraerConIA = conIA(env) ? (e: Parameters<typeof extraer>[0]) => extraer(e) : extraerSinIA;
  const destino = destinoConfigurado(env);
  if (destino === "almacen") {
    const a = almacen(env);
    return procesarEntrada(entrada, { almacen: a, extraer: extraerConIA, duplicados: await buscadorDuplicados(a) });
  }
  if (destino === "github")
    // En un PR no se pueden guardar datos de contacto (el repositorio puede ser público): se descartan
    return procesarEntradaGitHub(
      { ...entrada, contacto: undefined },
      { github: clienteGitHub({ token: env.GITHUB_TOKEN!, repo: env.GITHUB_REPO! }), extraer: extraerConIA },
    );
  throw new Error("La entrada de eventos no está configurada");
}
