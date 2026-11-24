"use client";

import { useMemo, useState } from "react";
import type { Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { capitalizar, diasDelEvento, nombreMes, fechaLarga } from "@/lib/fechas";
import { TarjetaEvento } from "./TarjetaEvento";

const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

export default function Calendario({ eventos, hoy }: { eventos: Evento[]; hoy: string | null }) {
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) for (const d of diasDelEvento(e)) m.set(d, [...(m.get(d) ?? []), e]);
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

  const delDia = sel ? porDia.get(sel) ?? [] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-[var(--linea)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => mover(-1)} className="rounded-lg px-3 py-1 hover:bg-[var(--arena)]" aria-label="Mes anterior">←</button>
          <h3 className="font-display text-xl">{nombreMes(mes.y, mes.m)}</h3>
          <button onClick={() => mover(1)} className="rounded-lg px-3 py-1 hover:bg-[var(--arena)]" aria-label="Mes siguiente">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--gris)]">
          {SEMANA.map((d) => <div key={d} className="py-1">{d}</div>)}
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
                onClick={() => setSel(d)}
                disabled={!evs.length}
                className={`flex aspect-square flex-col items-center justify-start rounded-xl p-1 text-sm transition sm:aspect-[4/3] ${
                  activo ? "bg-[var(--tinta)] text-white" : evs.length ? "bg-[var(--arena)] hover:bg-[#efe3cc]" : "text-[var(--gris)]/60"
                } ${esHoy && !activo ? "ring-2 ring-[var(--mar)]" : ""}`}
              >
                <span className="font-medium">{Number(d.slice(8))}</span>
                <span className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5">
                  {evs.slice(0, 4).map((e) => (
                    <span key={e.slug} className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIAS[e.categorias[0]].color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        {sel ? (
          <>
            <h3 className="mb-3 font-display text-xl">{capitalizar(fechaLarga(sel))}</h3>
            <div className="space-y-3">{delDia.map((e) => <TarjetaEvento key={e.slug} e={e} />)}</div>
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
