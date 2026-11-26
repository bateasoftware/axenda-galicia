"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LugarConocido } from "@/lib/lugares";

const CENTRO: [number, number] = [42.15, -8.78];

function AlHacerClic({ onClic }: { onClic: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClic(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Centra el mapa en el punto que se está editando */
function Seguir({ punto }: { punto: [number, number] | null }) {
  const map = useMap();
  const clave = punto ? punto.join(",") : "";
  useEffect(() => {
    if (!clave) return;
    const [lat, lng] = clave.split(",").map(Number);
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }, [map, clave]);
  return null;
}

/** Mapa de los lugares habituales: azul = exacto, naranja = aproximado, rojo = el que se edita. Un clic sitúa el que se edita. */
export default function MapaLugares({
  lugares,
  punto,
  onClicLugar,
  onClicMapa,
}: {
  lugares: LugarConocido[];
  punto: [number, number] | null;
  onClicLugar: (l: LugarConocido) => void;
  onClicMapa: (lat: number, lng: number) => void;
}) {
  return (
    <div className="h-[55vh] min-h-[320px] overflow-hidden rounded-2xl border border-[var(--linea)] lg:h-[calc(100dvh-14rem)]">
      <MapContainer center={CENTRO} zoom={11} scrollWheelZoom style={{ height: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <AlHacerClic onClic={onClicMapa} />
        <Seguir punto={punto} />
        {lugares.map((l) => (
          <CircleMarker
            key={`${l.concello}|${l.nombre}`}
            center={[l.lat, l.lng]}
            radius={7}
            pathOptions={{ color: "#fff", weight: 2, fillColor: l.aprox ? "#d97706" : "#0b5c8a", fillOpacity: 0.9, bubblingMouseEvents: false }}
            eventHandlers={{ click: () => onClicLugar(l) }}
          >
            <Tooltip>
              {l.nombre} · {l.concello}
              {l.aprox ? " (aprox.)" : ""}
            </Tooltip>
          </CircleMarker>
        ))}
        {punto && <CircleMarker center={punto} radius={11} pathOptions={{ color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  );
}
