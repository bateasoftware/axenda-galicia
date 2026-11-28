"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapaLeaflet, CircleMarker, LayerGroup } from "leaflet";
import type { LugarConocido } from "@/lib/lugares";

const CENTRO: [number, number] = [42.15, -8.78];

/**
 * Mapa de los lugares habituales: azul = exacto, naranja = aproximado, rojo = el que se edita. Un clic sitúa el que se edita.
 * Leaflet directo (no react-leaflet): el mapa se crea y se destruye en un solo efecto, sin errores al volver a montarse.
 */
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
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const capaLugares = useRef<LayerGroup | null>(null);
  const marcaPunto = useRef<CircleMarker | null>(null);
  // Los manejadores se leen siempre de aquí: así el mapa no se rehace cuando cambian
  const manejadores = useRef({ onClicLugar, onClicMapa });
  useEffect(() => {
    manejadores.current = { onClicLugar, onClicMapa };
  });

  // El mapa: se crea una vez y se destruye al desmontar
  useEffect(() => {
    let cancelado = false;
    let creado: MapaLeaflet | null = null;
    import("leaflet").then((leaflet) => {
      if (cancelado || !contenedor.current) return;
      creado = leaflet.map(contenedor.current, { scrollWheelZoom: true }).setView(CENTRO, 11);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(creado);
      creado.on("click", (e) => manejadores.current.onClicMapa(e.latlng.lat, e.latlng.lng));
      capaLugares.current = leaflet.layerGroup().addTo(creado);
      setL(leaflet);
      setMapa(creado);
    });
    return () => {
      cancelado = true;
      creado?.remove();
      capaLugares.current = null;
      marcaPunto.current = null;
      setMapa(null);
    };
  }, []);

  // Los lugares
  useEffect(() => {
    const capa = capaLugares.current;
    if (!mapa || !L || !capa) return;
    capa.clearLayers();
    for (const l of lugares)
      L.circleMarker([l.lat, l.lng], { radius: 7, color: "#fff", weight: 2, fillColor: l.aprox ? "#d97706" : "#16181d", fillOpacity: 0.9, bubblingMouseEvents: false })
        .bindTooltip(`${l.nombre} · ${l.concello}${l.aprox ? " (aprox.)" : ""}`)
        .on("click", () => manejadores.current.onClicLugar(l))
        .addTo(capa);
  }, [mapa, L, lugares]);

  // El punto que se edita (y el mapa lo sigue)
  const clave = punto ? punto.join(",") : "";
  useEffect(() => {
    if (!mapa || !L) return;
    marcaPunto.current?.remove();
    marcaPunto.current = null;
    if (!clave) return;
    const [lat, lng] = clave.split(",").map(Number);
    marcaPunto.current = L.circleMarker([lat, lng], { radius: 11, color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1, interactive: false }).addTo(mapa);
    mapa.setView([lat, lng], Math.max(mapa.getZoom(), 16));
  }, [mapa, L, clave]);

  return (
    <div className="h-[55vh] min-h-[320px] overflow-hidden rounded-2xl border border-[var(--linea)] lg:h-[calc(100dvh-14rem)]">
      <div ref={contenedor} style={{ height: "100%" }} />
    </div>
  );
}
