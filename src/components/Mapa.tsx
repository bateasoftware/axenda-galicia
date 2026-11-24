"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { Evento, Lugar } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { fechaCorta, hora, primerInicio } from "@/lib/fechas";

const CENTRO_COMARCA: [number, number] = [42.13, -8.8];

type Punto = { lat: number; lng: number; lugar: Lugar; eventos: Evento[] };

/** Agrupa los eventos que coinciden en el mismo sitio, para que no queden marcadores uno encima de otro */
function agrupar(eventos: Evento[]): Punto[] {
  const m = new Map<string, Punto>();
  for (const e of eventos)
    for (const l of e.lugares) {
      const clave = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
      const p = m.get(clave) ?? { lat: l.lat, lng: l.lng, lugar: l, eventos: [] };
      if (!p.eventos.includes(e)) p.eventos.push(e);
      m.set(clave, p);
    }
  return [...m.values()];
}

/** Encuadra todos los puntos al montar y cada vez que cambian los filtros */
function Encuadre({ puntos }: { puntos: Punto[] }) {
  const map = useMap();
  const clave = puntos.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    // Se reconstruyen las coordenadas desde la clave: así el efecto solo corre cuando cambian
    const coords = clave ? clave.split("|").map((c) => c.split(",").map(Number) as [number, number]) : [];
    if (!coords.length) map.setView(CENTRO_COMARCA, 11);
    else if (coords.length === 1) map.setView(coords[0], 15);
    else map.fitBounds(coords, { padding: [32, 32], maxZoom: 15 });
  }, [map, clave]);
  return null;
}

export default function Mapa({ eventos, alto }: { eventos: Evento[]; alto?: number }) {
  const puntos = agrupar(eventos);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--linea)] ${alto ? "" : "h-[60vh] max-h-[520px] min-h-[320px]"}`}
      style={alto ? { height: alto } : undefined}
    >
      <MapContainer center={CENTRO_COMARCA} zoom={11} scrollWheelZoom={false} style={{ height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Encuadre puntos={puntos} />
        {puntos.map((p) => {
          const color = CATEGORIAS[p.eventos[0].categorias[0]]?.color ?? "#0b5c8a";
          const varios = p.eventos.length > 1;
          return (
            <CircleMarker
              key={`${p.lat},${p.lng}`}
              center={[p.lat, p.lng]}
              radius={varios ? 13 : 10}
              pathOptions={{ color: "#fff", weight: 2, fillColor: varios ? "#0b2545" : color, fillOpacity: 0.95 }}
            >
              <Popup>
                <div style={{ minWidth: 180, maxWidth: 240 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>📍 {p.lugar.nombre}</div>
                  {p.eventos.map((e) => (
                    <div key={e.slug} style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: "#667085" }}>
                        {fechaCorta(primerInicio(e))} {hora(primerInicio(e))}
                      </div>
                      <a href={`/evento/${e.slug}`} style={{ fontWeight: 600, color: "#0b2545" }}>
                        {e.titulo}
                      </a>
                    </div>
                  ))}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
