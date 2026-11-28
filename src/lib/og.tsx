import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { COLORES } from "./marca";
import { SITIO } from "./sitio";

// Imagen para compartir (WhatsApp, redes, buscadores) cuando la página no tiene cartel
export const TAMANO_OG = { width: 1200, height: 630 };

// Space Grotesk (la letra de la marca, licencia OFL) se lee una vez y se incrusta en la imagen.
// Rutas fijas para que el despliegue incluya los ficheros (copias de @fontsource/space-grotesk en marca/fuentes).
const [SEMINEGRITA, NEGRITA] = await Promise.all([
  readFile(join(process.cwd(), "marca/fuentes/space-grotesk-600.woff")),
  readFile(join(process.cwd(), "marca/fuentes/space-grotesk-700.woff")),
]);

/** El logotipo: «alt» + la «o» que fala + «falante» */
function Logotipo({ tamano }: { tamano: number }) {
  const o = tamano * 0.54;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Space Grotesk", fontWeight: 600, fontSize: tamano, letterSpacing: "-0.03em", lineHeight: 1, color: COLORES.tinta }}>
      <span>alt</span>
      <svg width={o} height={o} viewBox="0 0 100 100" style={{ margin: `0 ${tamano * 0.02}px ${tamano * 0.2}px` }}>
        <circle cx="50" cy="50" r="41" fill="none" stroke={COLORES.tinta} strokeWidth="18" />
        <circle cx="50" cy="50" r="17" fill={COLORES.rojo} />
      </svg>
      <span>falante</span>
    </div>
  );
}

export function imagenOG(titulo: string, subtitulo: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: COLORES.crema,
          color: COLORES.tinta,
          fontFamily: "Space Grotesk",
        }}
      >
        <Logotipo tamano={84} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{titulo}</div>
          <div style={{ fontSize: 34, fontWeight: 600, color: "#5d5f66" }}>{subtitulo}</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, fontWeight: 600, color: COLORES.rojo }}>
          <span>{SITIO.eslogan}</span>
          <span style={{ color: "#5d5f66" }}>· Agenda de Val Miñor y Vigo · Mapa y calendario</span>
        </div>
      </div>
    ),
    {
      ...TAMANO_OG,
      fonts: [
        { name: "Space Grotesk", data: SEMINEGRITA, weight: 600, style: "normal" },
        { name: "Space Grotesk", data: NEGRITA, weight: 700, style: "normal" },
      ],
    },
  );
}
