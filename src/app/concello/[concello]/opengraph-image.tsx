import { concellos } from "@/lib/eventos";
import { imagenOG, TAMANO_OG } from "@/lib/og";

export const alt = "Agenda de eventos del concello";
export const size = TAMANO_OG;
export const contentType = "image/png";

export function generateStaticParams() {
  return concellos().map((c) => ({ concello: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ concello: string }> }) {
  const { concello } = await params;
  const nombre = concellos().find((c) => c.slug === concello)?.nombre ?? "Galicia";
  return imagenOG(`Qué hacer en ${nombre}`, "Agenda de fiestas, cine, deporte y planes con niños");
}
