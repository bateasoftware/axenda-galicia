"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import type { Evento } from "@/lib/tipos";
import { fechaCorta, hora, primerInicio } from "@/lib/fechas";
import { COLORES, svgMarcador } from "@/lib/marca";

// Leaflet directo (sin react-leaflet): el mapa se crea y se destruye en un solo efecto. Con react-leaflet, al volver atrás a una
// página con mapa (React vuelve a montar lo que estaba oculto) se lanzaba «Map container is being reused by another instance»
// y, en el móvil, salía «This page couldn't load».

const CENTRO_COMARCA: [number, number] = [42.13, -8.8];

type Punto = {
  lat: number;
  lng: number;
  lugar: string;
  varios: boolean;
  eventos: { slug: string; titulo: string; cuando: string }[];
};

/** Agrupa los eventos que coinciden en el mismo sitio, para que no queden marcadores uno encima de otro */
function agrupar(eventos: Evento[]): Punto[] {
  const m = new Map<string, Punto>();
  for (const e of eventos)
    for (const l of e.lugares) {
      const clave = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
      const p = m.get(clave) ?? { lat: l.lat, lng: l.lng, lugar: l.nombre, varios: false, eventos: [] };
      if (!p.eventos.some((x) => x.slug === e.slug)) p.eventos.push({ slug: e.slug, titulo: e.titulo, cuando: `${fechaCorta(primerInicio(e))} ${hora(primerInicio(e))}`.trim() });
      p.varios = p.eventos.length > 1;
      m.set(clave, p);
    }
  return [...m.values()];
}

/** El contenido de la burbuja de un punto, con nodos del DOM (los títulos nunca se interpretan como HTML) */
function burbuja(p: Punto): HTMLElement {
  const raiz = document.createElement("div");
  raiz.style.cssText = "min-width:180px;max-width:240px";
  const sitio = document.createElement("div");
  sitio.style.cssText = "font-size:12px;margin-bottom:4px";
  sitio.textContent = `📍 ${p.lugar}`;
  raiz.append(sitio);
  for (const e of p.eventos) {
    const fila = document.createElement("div");
    fila.style.marginTop = "6px";
    const cuando = document.createElement("div");
    cuando.style.cssText = "font-size:11px;color:#667085";
    cuando.textContent = e.cuando;
    const enlace = document.createElement("a");
    enlace.href = `/evento/${e.slug}`;
    enlace.style.cssText = `font-weight:600;color:${COLORES.tinta}`;
    enlace.textContent = e.titulo;
    fila.append(cuando, enlace);
    raiz.append(fila);
  }
  return raiz;
}

export default function Mapa({ eventos, alto }: { eventos: Evento[]; alto?: number }) {
  const contenedor = useRef<HTMLDivElement>(null);
  // Los puntos, como texto: el mapa solo se rehace cuando cambian de verdad (no en cada render)
  const clave = useMemo(() => JSON.stringify(agrupar(eventos)), [eventos]);

  useEffect(() => {
    const puntos = JSON.parse(clave) as Punto[];
    let cancelado = false;
    let mapa: import("leaflet").Map | null = null;
    import("leaflet").then((L) => {
      if (cancelado || !contenedor.current) return;
      mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView(CENTRO_COMARCA, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      // El marcador es el símbolo de la marca; si hay varios eventos en el mismo sitio, lleva su número
      for (const p of puntos) {
        const numero = p.varios
          ? `<span style="position:absolute;top:-6px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:${COLORES.rojo};color:#fff;font:600 12px/20px system-ui,sans-serif;text-align:center;border:2px solid #fff">${p.eventos.length}</span>`
          : "";
        const icono = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:36px;height:48px">${svgMarcador()}${numero}</div>`,
          iconSize: [36, 48],
          iconAnchor: [18, 47],
          popupAnchor: [0, -44],
        });
        L.marker([p.lat, p.lng], { icon: icono, title: p.lugar }).addTo(mapa).bindPopup(() => burbuja(p));
      }
      const coords = puntos.map((p) => [p.lat, p.lng] as [number, number]);
      if (!coords.length) mapa.setView(CENTRO_COMARCA, 11);
      else if (coords.length === 1) mapa.setView(coords[0], 15);
      else mapa.fitBounds(coords, { padding: [32, 32], maxZoom: 15 });
    });
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [clave]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--linea)] ${alto ? "" : "h-[60vh] max-h-[520px] min-h-[320px]"}`}
      style={alto ? { height: alto } : undefined}
    >
      <div ref={contenedor} style={{ height: "100%" }} />
    </div>
  );
}
