"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { fechaCorta, hora, primerInicio } from "@/lib/fechas";

export default function Mapa({ eventos, alto = 520 }: { eventos: Evento[]; alto?: number }) {
  const puntos = eventos.flatMap((e) => e.lugares.map((l) => ({ e, l })));
  const centro: [number, number] = puntos.length
    ? [
        puntos.reduce((s, p) => s + p.l.lat, 0) / puntos.length,
        puntos.reduce((s, p) => s + p.l.lng, 0) / puntos.length,
      ]
    : [42.13, -8.8];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--linea)]" style={{ height: alto }}>
      <MapContainer center={centro} zoom={puntos.length === 1 ? 15 : 12} scrollWheelZoom={false} style={{ height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {puntos.map(({ e, l }, i) => {
          const color = CATEGORIAS[e.categorias[0]]?.color ?? "#0b5c8a";
          return (
            <CircleMarker
              key={`${e.slug}-${i}`}
              center={[l.lat, l.lng]}
              radius={10}
              pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.95 }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 11, color: "#667085" }}>
                    {fechaCorta(primerInicio(e))} {hora(primerInicio(e))}
                  </div>
                  <a href={`/evento/${e.slug}`} style={{ fontWeight: 600, color: "#0b2545" }}>
                    {e.titulo}
                  </a>
                  <div style={{ fontSize: 12, marginTop: 2 }}>📍 {l.nombre}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
