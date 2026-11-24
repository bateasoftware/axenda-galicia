import { todosLosEventos } from "@/lib/eventos";
import { fechaHoraGalicia } from "@/lib/fechas";
import { SITIO } from "@/lib/sitio";
import { htmlWidget, leerOpciones } from "@/lib/widget";

// GET /widget/agenda?concello=nigran,baiona&n=6&tema=claro — HTML para insertar con un iframe (ver /widget)
export async function GET(request: Request) {
  const opciones = leerOpciones(new URL(request.url).searchParams);
  const html = htmlWidget(await todosLosEventos(), opciones, SITIO, fechaHoraGalicia());
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Se puede insertar en cualquier web; la CDN lo guarda media hora
      "Content-Security-Policy": "frame-ancestors *",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
