import fs from "node:fs";
import path from "node:path";
import { almacenLocal, remotoConfigurado } from "@/lib/almacen";
import { autorizado } from "@/lib/admin/sesion";

// Cartel de un pendiente en el almacén local (en la nube los carteles tienen URL pública)
const TIPOS: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_req: Request, ctx: RouteContext<"/admin/cartel/[id]">) {
  if (!(await autorizado()) || remotoConfigurado()) return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(id)) return new Response("No encontrado", { status: 404 });
  const raiz = process.cwd();
  const json = path.join(raiz, "data", "pendientes", `${id}.json`);
  if (!fs.existsSync(json) || !(await almacenLocal(raiz).pendiente(id))) return new Response("No encontrado", { status: 404 });
  const crudo = JSON.parse(fs.readFileSync(json, "utf8"));
  const rel = typeof crudo._cartel === "string" ? crudo._cartel : typeof crudo._imagen === "string" ? path.join("data", "entrada", crudo._imagen) : null;
  const fichero = rel && path.resolve(/*turbopackIgnore: true*/ raiz, rel);
  // Solo ficheros dentro de data/
  if (!fichero || !fichero.startsWith(path.join(raiz, "data") + path.sep) || !fs.existsSync(/*turbopackIgnore: true*/ fichero)) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(/*turbopackIgnore: true*/ fichero)), {
    headers: { "Content-Type": TIPOS[path.extname(fichero).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "private, max-age=300" },
  });
}
