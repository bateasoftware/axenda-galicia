import { after } from "next/server";
import { autorizado } from "@/lib/admin/sesion";
import { todosLosEventos } from "@/lib/eventos";
import { fechaHoraGalicia } from "@/lib/fechas";
import { almacenMetricas } from "@/lib/metricas/almacen";
import { filasDeHits, type Hit } from "@/lib/metricas/modelo";
import { leerPeticion } from "@/lib/metricas/peticion";

// POST /api/m — registro de métricas propias (vistas, clics, apariciones en listados…).
// Cuerpo: {"e": [["vista", "slug-del-evento"], ["impresion", "otro-slug"], …]} (máx. 80), enviado con sendBeacon.
// Sin cookies ni datos personales: no se guarda IP, ni navegador, ni identificador; solo contadores por día.
// Se responde al momento (204) y se escribe después. Sin base de datos configurada, no hace nada.

const vacia = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const metricas = almacenMetricas();
  if (!metricas) return vacia();
  const r = leerPeticion(request.headers, await request.text());
  if ("estado" in r) return new Response(null, { status: r.estado });
  // Las visitas de quien administra no cuentan
  if (await autorizado()) return vacia();
  const validos = r.pares;

  after(async () => {
    try {
      // Solo eventos publicados (y así se sabe su concello, organizadores y categorías)
      const porSlug = new Map((await todosLosEventos()).map((e) => [e.slug, e]));
      const hits: Hit[] = validos.flatMap(([tipo, slug]) => {
        const evento = porSlug.get(slug);
        return evento ? [{ tipo, evento }] : [];
      });
      await metricas.registrar(filasDeHits(hits, fechaHoraGalicia().slice(0, 10)));
    } catch (err) {
      console.error("[metricas]", (err as Error).message);
    }
  });
  return vacia();
}
