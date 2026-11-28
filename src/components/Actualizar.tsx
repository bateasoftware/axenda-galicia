"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

const UMBRAL = 70; // píxeles de arrastre para actualizar
const MAXIMO = 110;

/** ¿Hay algo desplazable (o un mapa) bajo el dedo? Entonces el gesto es suyo, no de la página. */
function gestoAjeno(el: EventTarget | null): boolean {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    if (n.closest?.(".leaflet-container, input, textarea, select, [contenteditable]") === n) return true;
    if (n.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Botón «Actualizar» y gesto de deslizar hacia abajo desde arriba del todo (como en las apps).
 * En la PWA instalada no hay barra del navegador ni recarga nativa, y los eventos nuevos solo se ven al volver a pedirlos.
 * Funciona igual en el panel de admin.
 */
export default function Actualizar() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);
  const ultimo = useRef(0);

  const actualizar = useCallback(() => {
    empezar(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const alEmpezar = (e: TouchEvent) => {
      inicio.current = window.scrollY <= 0 && e.touches.length === 1 && !gestoAjeno(e.target) ? e.touches[0].clientY : null;
      ultimo.current = 0;
    };
    const alMover = (e: TouchEvent) => {
      if (inicio.current === null) return;
      const dy = e.touches[0].clientY - inicio.current;
      if (dy <= 0 || window.scrollY > 0) {
        inicio.current = null;
        ultimo.current = 0;
        setArrastre(0);
        return;
      }
      ultimo.current = Math.min(MAXIMO, dy * 0.5);
      setArrastre(ultimo.current);
    };
    const alSoltar = () => {
      if (inicio.current !== null && ultimo.current >= UMBRAL * 0.5) actualizar();
      inicio.current = null;
      ultimo.current = 0;
      setArrastre(0);
    };
    addEventListener("touchstart", alEmpezar, { passive: true });
    addEventListener("touchmove", alMover, { passive: true });
    addEventListener("touchend", alSoltar);
    addEventListener("touchcancel", alSoltar);
    return () => {
      removeEventListener("touchstart", alEmpezar);
      removeEventListener("touchmove", alMover);
      removeEventListener("touchend", alSoltar);
      removeEventListener("touchcancel", alSoltar);
    };
  }, [actualizar]);

  const visible = pendiente || arrastre > 0;
  const listo = arrastre >= UMBRAL * 0.5;
  return (
    <>
      <button
        type="button"
        onClick={actualizar}
        disabled={pendiente}
        title="Actualizar"
        aria-label="Actualizar la página"
        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--gris)] hover:bg-[var(--arena)] hover:text-[var(--tinta)] disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pendiente ? "animate-spin" : ""} aria-hidden>
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </svg>
      </button>
      {visible &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex justify-center"
            style={{ transform: `translateY(${pendiente ? 56 : Math.max(0, arrastre) - 12}px)`, transition: arrastre ? "none" : "transform .2s" }}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--linea)] bg-white shadow-md">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="var(--marca)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={pendiente ? "animate-spin" : ""}
                style={pendiente ? undefined : { transform: `rotate(${listo ? 180 : arrastre * 3}deg)` }}
                aria-hidden
              >
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v5h-5" />
              </svg>
              <span className="sr-only">{pendiente ? "Actualizando…" : listo ? "Suelta para actualizar" : "Desliza para actualizar"}</span>
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
