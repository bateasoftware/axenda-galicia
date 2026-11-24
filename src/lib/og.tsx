import { ImageResponse } from "next/og";
import { SITIO } from "./sitio";

// Imagen para compartir (WhatsApp, redes, buscadores) cuando la página no tiene cartel
export const TAMANO_OG = { width: 1200, height: 630 };

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
          background: "#0b2545",
          color: "#fcfaf6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#fcfaf6",
              color: "#0b2545",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{SITIO.nombre}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{titulo}</div>
          <div style={{ fontSize: 34, color: "#b9d4e0" }}>{subtitulo}</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#f6efe2" }}>
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
