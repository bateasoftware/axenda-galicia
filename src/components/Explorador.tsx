"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Categoria, Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { capitalizar, dia, fechaLarga, hoyGalicia, primerInicio, rangoFinde, ultimoFin } from "@/lib/fechas";
import { TarjetaEvento } from "./TarjetaEvento";
import Calendario from "./Calendario";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-2xl bg-[var(--arena)]" />,
});

const sinSuscripcion = () => () => {};

type Vista = "lista" | "mapa" | "calendario";
type Cuando = "proximos" | "finde" | "todos";

export default function Explorador({ eventos, concelloFijo }: { eventos: Evento[]; concelloFijo?: string }) {
  const [vista, setVista] = useState<Vista>("lista");
  const [cuando, setCuando] = useState<Cuando>("proximos");
  const [concello, setConcello] = useState<string>(concelloFijo ?? "");
  const [cats, setCats] = useState<Categoria[]>([]);
  // "Hoy" solo existe en el navegador; en el HTML estático se muestran todos
  const hoy = useSyncExternalStore(sinSuscripcion, hoyGalicia, () => null);

  const concellos = useMemo(() => [...new Set(eventos.map((e) => e.concello))].sort(), [eventos]);
  const catsPresentes = useMemo(
    () => (Object.keys(CATEGORIAS) as Categoria[]).filter((c) => eventos.some((e) => e.categorias.includes(c))),
    [eventos],
  );

  const filtrados = useMemo(() => {
    return eventos.filter((e) => {
      if (concello && e.concello !== concello) return false;
      if (cats.length && !cats.some((c) => e.categorias.includes(c))) return false;
      if (!hoy || cuando === "todos") return true;
      const fin = dia(ultimoFin(e));
      if (cuando === "proximos") return fin >= hoy;
      const [v, d] = rangoFinde(hoy);
      return dia(primerInicio(e)) <= d && fin >= v;
    });
  }, [eventos, concello, cats, cuando, hoy]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of filtrados) {
      const d = dia(primerInicio(e));
      m.set(d, [...(m.get(d) ?? []), e]);
    }
    return [...m.entries()];
  }, [filtrados]);

  const toggleCat = (c: Categoria) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition whitespace-nowrap ${
      activo ? "border-[var(--tinta)] bg-[var(--tinta)] text-white" : "border-[var(--linea)] bg-white hover:border-[var(--tinta)]"
    }`;

  return (
    <section>
      {/* Selector de vista */}
      <div className="mb-4 inline-flex rounded-full bg-[var(--arena)] p-1">
        {(["lista", "mapa", "calendario"] as Vista[]).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              vista === v ? "bg-white text-[var(--tinta)] shadow-sm" : "text-[var(--gris)]"
            }`}
          >
            {v === "lista" ? "☰ Lista" : v === "mapa" ? "🗺️ Mapa" : "📅 Calendario"}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-6 space-y-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {vista !== "calendario" &&
            (
              [
                ["proximos", "Próximos"],
                ["finde", "Este finde"],
                ["todos", "Todos"],
              ] as [Cuando, string][]
            ).map(([k, t]) => (
              <button key={k} onClick={() => setCuando(k)} className={chip(cuando === k)}>
                {t}
              </button>
            ))}
          {!concelloFijo && (
            <select
              value={concello}
              onChange={(ev) => setConcello(ev.target.value)}
              className="rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-sm"
              aria-label="Concello"
            >
              <option value="">Todos los concellos</option>
              {concellos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {catsPresentes.map((c) => (
            <button key={c} onClick={() => toggleCat(c)} className={chip(cats.includes(c))}>
              {CATEGORIAS[c].emoji} {CATEGORIAS[c].nombre}
            </button>
          ))}
        </div>
      </div>

      {vista === "lista" &&
        (porDia.length ? (
          <div className="space-y-8">
            {porDia.map(([d, evs]) => (
              <div key={d}>
                <h2 className="mb-3 font-display text-xl text-[var(--tinta)]">
                  {d === hoy ? "Hoy · " : ""}
                  {capitalizar(fechaLarga(d))}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {evs.map((e) => (
                    <TarjetaEvento key={e.slug} e={e} pasado={!!hoy && dia(ultimoFin(e)) < hoy} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Vacio onTodos={() => setCuando("todos")} />
        ))}

      {vista === "mapa" && (
        <>
          <Mapa eventos={filtrados} />
          <p className="mt-2 text-xs text-[var(--gris)]">{filtrados.length} eventos en el mapa · ubicaciones aproximadas en esta versión</p>
        </>
      )}

      {vista === "calendario" && <Calendario key={hoy ?? "x"} eventos={eventos.filter((e) => (!concello || e.concello === concello) && (!cats.length || cats.some((c) => e.categorias.includes(c))))} hoy={hoy} />}
    </section>
  );
}

function Vacio({ onTodos }: { onTodos: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--linea)] p-8 text-center text-[var(--gris)]">
      <p>No hay eventos con estos filtros.</p>
      <button onClick={onTodos} className="mt-2 font-medium text-[var(--mar)] underline">
        Ver también los pasados
      </button>
    </div>
  );
}
