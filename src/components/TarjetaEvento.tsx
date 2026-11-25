"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { medir } from "@/lib/metricas/cliente";
import Image from "next/image";
import CartelGenerico from "./CartelGenerico";
import type { Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { fechaCorta, hora, primerInicio, ultimoFin, dia } from "@/lib/fechas";

export function EtiquetaCategoria({ c }: { c: Evento["categorias"][number] }) {
  const cat = CATEGORIAS[c];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${cat.color}14`, color: cat.color }}
    >
      <span aria-hidden>{cat.emoji}</span>
      {cat.nombre}
    </span>
  );
}

/** Cuenta una aparición en un listado cuando la tarjeta se ve (al menos la mitad, un segundo) */
function useImpresion(slug: string) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) t = setTimeout(() => (medir("impresion", slug), obs.disconnect()), 1000);
        else if (t) clearTimeout(t);
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (t) clearTimeout(t);
    };
  }, [slug]);
  return ref;
}

export function TarjetaEvento({ e, pasado = false, hoy }: { e: Evento; pasado?: boolean; hoy?: string }) {
  const ini = primerInicio(e);
  const fin = ultimoFin(e);
  const variosDias = dia(ini) !== dia(fin);
  const ref = useImpresion(e.slug);
  const destacado = !!hoy && !!e.destacado_hasta && e.destacado_hasta >= hoy;
  return (
    <Link
      ref={ref}
      href={`/evento/${e.slug}`}
      onClick={() => medir("clic", e.slug)}
      className={`group relative flex min-w-0 gap-3 rounded-2xl sm:gap-4 border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md ${destacado ? "border-[var(--mar)] ring-1 ring-[var(--mar)]/30" : "border-[var(--linea)]"} ${pasado ? "opacity-60" : ""}`}
    >
      {destacado && (
        <span className="absolute -top-2 right-3 rounded-full bg-[var(--mar)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">Destacado</span>
      )}
      <div className="relative h-28 w-20 shrink-0 sm:w-24 overflow-hidden rounded-xl bg-[var(--arena)] sm:h-32 sm:w-28">
        {e.cartel ? (
          <Image src={e.cartel} alt={`Cartel: ${e.titulo}`} fill sizes="112px" className="object-cover" />
        ) : (
          // Sin cartel: ilustración genérica de su categoría (solo presentación)
          <CartelGenerico categorias={e.categorias} className="absolute inset-0 h-full w-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mar)]">
          {fechaCorta(ini)}
          {variosDias && ` – ${fechaCorta(fin)}`}
          {hora(ini) && ` · ${hora(ini)}`}
          {pasado && " · Ya pasó"}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-lg leading-snug text-[var(--tinta)] group-hover:text-[var(--mar)]">
          {e.titulo}
        </h3>
        <p className="mt-1 truncate text-sm text-[var(--gris)]">
          📍 {e.lugares[0]?.nombre} · {e.parroquia ? `${e.parroquia}, ` : ""}
          {e.concello}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {e.categorias.slice(0, 3).map((c) => (
            <EtiquetaCategoria key={c} c={c} />
          ))}
        </div>
      </div>
    </Link>
  );
}
