import { imagenOG, TAMANO_OG } from "@/lib/og";
import { SITIO } from "@/lib/sitio";

export const alt = `${SITIO.nombre}: ${SITIO.lema}`;
export const size = TAMANO_OG;
export const contentType = "image/png";

export default function Image() {
  return imagenOG(SITIO.lema, "Fiestas, cine, deporte, mercadillos y planes con niños en Baiona, Nigrán, Gondomar y Vigo");
}
