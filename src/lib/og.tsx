import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITIO } from "./sitio";

// Imagen para compartir (WhatsApp, redes, buscadores) cuando la página no tiene cartel
export const TAMANO_OG = { width: 1200, height: 630 };

// El logo se lee una vez (no depende de la petición) y se incrusta como data URL
const LOGO = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/marca/logo.png"))).toString("base64")}`;
const PROPORCION_LOGO = 1476 / 347;

export function imagenOG(titulo: string, subtitulo: string) {
  const altoLogo = 96;
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
          background: "#fcfaf6",
          color: "#0b2545",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt={SITIO.nombre} width={Math.round(altoLogo * PROPORCION_LOGO)} height={altoLogo} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{titulo}</div>
          <div style={{ fontSize: 34, color: "#5f6b7a" }}>{subtitulo}</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#0b6e8a" }}>
          <span>📅 Calendario</span>
          <span>·</span>
          <span>🗺️ Mapa</span>
          <span>·</span>
          <span>Gratis</span>
        </div>
      </div>
    ),
    TAMANO_OG,
  );
}
