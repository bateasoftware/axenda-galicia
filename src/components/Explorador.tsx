"use client";

import dynamic from "next/dynamic";
import { useMemo, useSyncExternalStore } from "react";
import type { Categoria, Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { capitalizar, dia, fechaLarga, hoyGalicia, primerInicio, rangoFinde, ultimoFin } from "@/lib/fechas";
import { slugConcello } from "@/lib/slug";
import { TarjetaEvento } from "./TarjetaEvento";
import Calendario from "./Calendario";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="h-[60vh] max-h-[520px] min-h-[320px] animate-pulse rounded-2xl bg-[var(--arena)]" />,
});

type Vista = "lista" | "mapa" | "calendario";
type Cuando = "proximos" | "finde" | "todos";

const VISTAS: [Vista, string][] = [
  ["lista", "☰ Lista"],
  ["mapa", "🗺️ Mapa"],
  ["calendario", "📅 Calendario"],
];
const CUANDOS: [Cuando, string][] = [
  ["proximos", "Próximos"],
  ["finde", "Este finde"],
  ["todos", "Todos"],
];

// --- Filtros en la URL (?vista=mapa&cuando=finde&concello=baiona&cat=infantil,cine) ---
// La URL es la única fuente de verdad: así un filtro se puede compartir por WhatsApp.
const EVENTO_URL = "axenda:url";

function suscribirUrl(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENTO_URL, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENTO_URL, cb);
  };
}

function cambiarUrl(cambios: Record<string, string | null>) {
  const p = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(cambios)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const qs = p.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  window.dispatchEvent(new Event(EVENTO_URL));
}

const sinSuscripcion = () => () => {};

export default function Explorador({ eventos, concelloFijo }: { eventos: Evento[]; concelloFijo?: string }) {
  // "Hoy" y la URL solo existen en el navegador; en el HTML estático se muestra un esqueleto
  const hoy = useSyncExternalStore(sinSuscripcion, hoyGalicia, () => null);
  const busqueda = useSyncExternalStore(suscribirUrl, () => window.location.search, () => "");
  const listo = hoy !== null;

  const concellos = useMemo(() => [...new Set(eventos.map((e) => e.concello))].sort(), [eventos]);
  const catsPresentes = useMemo(
    () => (Object.keys(CATEGORIAS) as Categoria[]).filter((c) => eventos.some((e) => e.categorias.includes(c))),
    [eventos],
  );

  const p = new URLSearchParams(busqueda);
  const vista: Vista = VISTAS.some(([v]) => v === p.get("vista")) ? (p.get("vista") as Vista) : "lista";
  const cuando: Cuando = CUANDOS.some(([c]) => c === p.get("cuando")) ? (p.get("cuando") as Cuando) : "proximos";
  const concello = concelloFijo ?? concellos.find((c) => slugConcello(c) === p.get("concello")) ?? "";
  const catsUrl = p.get("cat")?.split(",") ?? [];
  const cats = catsPresentes.filter((c) => catsUrl.includes(c));

  // Filtrar unos cientos de eventos es instantáneo: no hace falta memorizar
  const filtrados = eventos.filter((e) => {
    if (concello && e.concello !== concello) return false;
    if (cats.length && !cats.some((c) => e.categorias.includes(c))) return false;
    if (!hoy || cuando === "todos") return true;
    const fin = dia(ultimoFin(e));
    if (cuando === "proximos") return fin >= hoy;
    const [v, d] = rangoFinde(hoy);
    return dia(primerInicio(e)) <= d && fin >= v;
  });

  const porDia = new Map<string, Evento[]>();
  for (const e of filtrados) {
    const d = dia(primerInicio(e));
    porDia.set(d, [...(porDia.get(d) ?? []), e]);
  }

  const toggleCat = (c: Categoria) => {
    const nuevas = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
    cambiarUrl({ cat: nuevas.length ? nuevas.join(",") : null });
  };

  const chip = (activo: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm transition whitespace-nowrap ${
      activo ? "border-[var(--tinta)] bg-[var(--tinta)] text-white" : "border-[var(--linea)] bg-white hover:border-[var(--tinta)]"
    }`;

  return (
    <section className="min-w-0">
      {/* Selector de vista */}
      <div className="mb-4 flex w-full rounded-full bg-[var(--arena)] p-1 sm:inline-flex sm:w-auto" role="group" aria-label="Vista">
        {VISTAS.map(([v, t]) => (
          <button
            key={v}
            onClick={() => cambiarUrl({ vista: v === "lista" ? null : v })}
            aria-pressed={vista === v}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition sm:flex-none sm:px-4 ${
              vista === v ? "bg-white text-[var(--tinta)] shadow-sm" : "text-[var(--gris)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filtros: en móvil, filas que se desplazan en horizontal */}
      <div className="mb-6 space-y-3">
        <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Cuándo">
          {vista !== "calendario" &&
            CUANDOS.map(([k, t]) => (
              <button key={k} onClick={() => cambiarUrl({ cuando: k === "proximos" ? null : k })} aria-pressed={cuando === k} className={chip(cuando === k)}>
                {t}
              </button>
            ))}
          {!concelloFijo && (
            <select
              value={concello}
              onChange={(ev) => cambiarUrl({ concello: ev.target.value ? slugConcello(ev.target.value) : null })}
              className="shrink-0 rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-sm"
              aria-label="Concello"
            >
              <option value="">Todos los concellos</option>
              {concellos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Categorías">
          {catsPresentes.map((c) => (
            <button key={c} onClick={() => toggleCat(c)} aria-pressed={cats.includes(c)} className={chip(cats.includes(c))}>
              {CATEGORIAS[c].emoji} {CATEGORIAS[c].nombre}
            </button>
          ))}
        </div>
      </div>

      {!listo ? (
        <Esqueleto />
      ) : (
        <>
          {vista === "lista" &&
            (porDia.size ? (
              <div className="space-y-8">
                {[...porDia].map(([d, evs]) => (
                  <div key={d}>
                    <h2 className="mb-3 font-display text-xl text-[var(--tinta)]">
                      {d === hoy ? "Hoy · " : ""}
                      {capitalizar(fechaLarga(d))}
                    </h2>
                    {/* minmax(0,1fr): sin esto la columna crece con el texto largo y desborda en móvil */}
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                      {evs.map((e) => (
                        <TarjetaEvento key={e.slug} e={e} pasado={dia(ultimoFin(e)) < hoy} hoy={hoy} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Vacio
                hayFiltros={!!cats.length || (!!concello && !concelloFijo)}
                onTodos={() => cambiarUrl({ cuando: "todos" })}
                onLimpiar={() => cambiarUrl({ cat: null, concello: null })}
              />
            ))}

          {vista === "mapa" && (
            <>
              <Mapa eventos={filtrados} />
              <p className="mt-2 text-xs text-[var(--gris)]">
                {filtrados.length} {filtrados.length === 1 ? "evento" : "eventos"} en el mapa · algunas ubicaciones son aproximadas
              </p>
            </>
          )}

          {vista === "calendario" && (
            <Calendario
              eventos={eventos.filter((e) => (!concello || e.concello === concello) && (!cats.length || cats.some((c) => e.categorias.includes(c))))}
              hoy={hoy}
            />
          )}
        </>
      )}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-6 w-48 animate-pulse rounded bg-[var(--arena)]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--arena)] sm:h-36" />
      ))}
    </div>
  );
}

function Vacio({ hayFiltros, onTodos, onLimpiar }: { hayFiltros: boolean; onTodos: () => void; onLimpiar: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--linea)] p-8 text-center text-[var(--gris)]">
      <p>No hay eventos con estos filtros.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {hayFiltros && (
          <button onClick={onLimpiar} className="font-medium text-[var(--mar)] underline">
            Quitar filtros
          </button>
        )}
        <button onClick={onTodos} className="font-medium text-[var(--mar)] underline">
          Ver también los pasados
        </button>
      </div>
    </div>
  );
}
