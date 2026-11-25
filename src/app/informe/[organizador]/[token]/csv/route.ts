import { tokenValido } from "@/lib/metricas/informes";
import { informeOrganizador } from "@/lib/metricas/organizador";

// Los datos del informe de un organizador en CSV (Excel, LibreOffice, Google Sheets). Mismo enlace secreto.
const celda = (v: string | number) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);

export async function GET(_req: Request, ctx: RouteContext<"/informe/[organizador]/[token]/csv">) {
  const { organizador, token } = await ctx.params;
  if (!tokenValido(organizador, token)) return new Response("No encontrado", { status: 404 });
  const inf = await informeOrganizador(organizador);
  if (!inf) return new Response("No encontrado", { status: 404 });
  const filas = [
    ["Evento", "Fecha", "Concello", "Visitas", "Apariciones en la agenda", "Clics desde la agenda", "Cómo llegar", "Calendario", "Inscripción", "Compartido"],
    ...inf.eventos.map(({ evento: e, t }) => [
      e.titulo,
      e.sesiones[0]?.inicio.replace("T", " ") ?? "",
      e.concello,
      t.vista,
      t.impresion,
      t.clic,
      t["como-llegar"],
      t.calendario,
      t.inscripcion,
      t.compartir,
    ]),
  ];
  // BOM para que Excel abra bien las tildes
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-${organizador}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
