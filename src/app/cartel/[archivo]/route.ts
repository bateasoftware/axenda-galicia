import { almacenTursoDesdeEnv, tursoConfigurado } from "@/lib/almacen";

// GET /cartel/<id>.jpg — carteles guardados en la base de datos de Turso.
// El id es un UUID que no cambia: se puede guardar en caché para siempre (CDN y navegador).
export async function GET(_req: Request, ctx: RouteContext<"/cartel/[archivo]">) {
  const { archivo } = await ctx.params;
  const m = archivo.match(/^([0-9a-f-]{36})\.(jpg|png|webp)$/);
  if (!m || !tursoConfigurado()) return new Response("No encontrado", { status: 404 });
  const c = await almacenTursoDesdeEnv().cartel(m[1]);
  if (!c) return new Response("No encontrado", { status: 404 });
  return new Response(c.datos as BodyInit, {
    headers: { "Content-Type": c.tipo, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
