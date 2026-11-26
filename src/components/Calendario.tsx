"use client";

import { useMemo, useRef, useState } from "react";
import type { Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { capitalizar, dia, diasDelEvento, nombreMes, fechaLarga, primerInicio, ultimoFin } from "@/lib/fechas";
import { esLargaDuracion } from "@/lib/larga-duracion";
import { TarjetaEvento } from "./TarjetaEvento";

const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

export default function Calendario({ eventos, hoy }: { eventos: Evento[]; hoy: string | null }) {
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    // Las exposiciones largas solo marcan el día que abren y el que cierran (si no, llenarían el mes)
    const dias = (e: Evento) => (esLargaDuracion(e) ? [...new Set([dia(primerInicio(e)), dia(ultimoFin(e))])] : diasDelEvento(e));
    for (const e of eventos) for (const d of dias(e)) m.set(d, [...(m.get(d) ?? []), e]);
    return m;
  }, [eventos]);

  const inicial = hoy ?? [...porDia.keys()].sort()[0] ?? "2026-11-01";
  const [mes, setMes] = useState({ y: Number(inicial.slice(0, 4)), m: Number(inicial.slice(5, 7)) });
  const [sel, setSel] = useState<string | null>(null);

  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(mes.y, mes.m - 1, 1));
    const offset = (primero.getUTCDay() + 6) % 7; // lunes = 0
    const diasMes = new Date(Date.UTC(mes.y, mes.m, 0)).getUTCDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= diasMes; d++)
      out.push(`${mes.y}-${String(mes.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [mes]);

  const mover = (delta: number) => {
    const d = new Date(Date.UTC(mes.y, mes.m - 1 + delta, 1));
    setMes({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
    setSel(null);
  };

  // En móvil la lista del día queda debajo del calendario: se desplaza hasta ella
  const detalle = useRef<HTMLDivElement>(null);
  const elegir = (d: string) => {
    setSel(d);
    if (window.matchMedia("(max-width: 1023px)").matches)
      requestAnimationFrame(() => detalle.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const delDia = sel ? porDia.get(sel) ?? [] : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-[var(--linea)] bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => mover(-1)} className="rounded-lg px-3 py-1 hover:bg-[var(--arena)]" aria-label="Mes anterior">←</button>
          <h3 className="font-display text-xl" aria-live="polite">{nombreMes(mes.y, mes.m)}</h3>
          <button onClick={() => mover(1)} className="rounded-lg px-3 py-1 hover:bg-[var(--arena)]" aria-label="Mes siguiente">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--gris)]">
          {SEMANA.map((d, i) => <div key={i} className="py-1" aria-hidden>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d, i) => {
            if (!d) return <div key={i} />;
            const evs = porDia.get(d) ?? [];
            const esHoy = d === hoy;
            const activo = d === sel;
            return (
              <button
                key={d}
                onClick={() => elegir(d)}
                disabled={!evs.length}
                aria-pressed={activo}
                aria-label={`${capitalizar(fechaLarga(d))}${esHoy ? " (hoy)" : ""}: ${evs.length ? `${evs.length} ${evs.length === 1 ? "evento" : "eventos"}` : "sin eventos"}`}
                className={`flex aspect-square min-w-0 flex-col items-center justify-start rounded-xl p-1 text-sm transition sm:aspect-[4/3] ${
                  activo ? "bg-[var(--tinta)] text-white" : evs.length ? "bg-[var(--arena)] hover:bg-[#efe3cc]" : "text-[var(--gris)]/60"
                } ${esHoy && !activo ? "ring-2 ring-[var(--mar)]" : ""}`}
              >
                <span className="font-medium" aria-hidden>{Number(d.slice(8))}</span>
                <span className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5" aria-hidden>
                  {evs.slice(0, 4).map((e) => (
                    <span key={e.slug} className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIAS[e.categorias[0]]?.color ?? "#0b5c8a" }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div ref={detalle} className="min-w-0 scroll-mt-20">
        {sel ? (
          <>
            <h3 className="mb-3 font-display text-xl">{capitalizar(fechaLarga(sel))}</h3>
            <div className="space-y-3">{delDia.map((e) => <TarjetaEvento key={e.slug} e={e} hoy={hoy ?? undefined} />)}</div>
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--linea)] p-6 text-[var(--gris)]">
            Toca un día marcado para ver sus eventos.
          </p>
        )}
      </div>
    </div>
  );
}
