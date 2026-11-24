import { eventoPorSlug, todosLosEventos } from "@/lib/eventos";
import { generarICS } from "@/lib/fechas";
import { SITIO } from "@/lib/sitio";

// Un .ics por evento, generado en el build (Safari en iOS no descarga bien los data: URL)
export async function generateStaticParams() {
  return (await todosLosEventos()).map((e) => ({ slug: e.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/evento/[slug]/calendario.ics">) {
  const { slug } = await ctx.params;
  const e = await eventoPorSlug(slug);
  if (!e) return new Response("No encontrado", { status: 404 });
  return new Response(generarICS(e, `${SITIO.url}/evento/${e.slug}`), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${e.slug}.ics"`,
    },
  });
}
