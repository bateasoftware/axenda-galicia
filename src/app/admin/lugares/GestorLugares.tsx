"use client";

import dynamic from "next/dynamic";
import { useActionState, useMemo, useState } from "react";
import { enlaceBuscarSitio, enlaceCoordenadas, formatoCoordenadas, parsearCoordenadas } from "@/lib/coordenadas";
import { claveLugar, type LugarConocido } from "@/lib/lugares";
import type { Sugerencia } from "@/lib/lugares-sugeridos";
import { borrarLugar, guardarLugar, type EstadoLugar } from "./acciones";

const MapaLugares = dynamic(() => import("./MapaLugares"), {
  ssr: false,
  loading: () => <div className="h-[55vh] min-h-[320px] animate-pulse rounded-2xl bg-[var(--arena)] lg:h-[calc(100dvh-14rem)]" />,
});

const campo = "w-full rounded-xl border border-[var(--linea)] bg-white px-3 py-2 text-[15px]";
const boton = "rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-sm hover:border-[var(--tinta)]";
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Edicion = {
  anterior?: { nombre: string; concello: string };
  nombre: string;
  concello: string;
  parroquia: string;
  direccion: string;
  coords: string;
  aprox: boolean;
};

const desdeLugar = (l: LugarConocido): Edicion => ({
  anterior: { nombre: l.nombre, concello: l.concello },
  nombre: l.nombre,
  concello: l.concello,
  parroquia: l.parroquia ?? "",
  direccion: l.direccion ?? "",
  coords: formatoCoordenadas(l.lat, l.lng),
  aprox: !!l.aprox,
});

export default function GestorLugares({
  lugares,
  usos,
  concellos,
  parroquias,
  centros,
  sugerencias,
}: {
  lugares: LugarConocido[];
  usos: Record<string, number>;
  concellos: string[];
  parroquias: Record<string, string[]>;
  centros: Record<string, [number, number]>;
  sugerencias: Sugerencia[];
}) {
  const [buscar, setBuscar] = useState("");
  const [concello, setConcello] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Al guardar bien, se cierra el editor y se enseña el aviso
  const [estado, accion, guardando] = useActionState<EstadoLugar, FormData>(async (previo, f) => {
    const r = await guardarLugar(previo, f);
    if (r.tipo === "ok") {
      setEdicion(null);
      setMensaje(r.mensaje);
    }
    return r;
  }, { tipo: "inicial" });

  const visibles = useMemo(
    () =>
      lugares
        .filter((l) => !concello || l.concello === concello)
        .filter((l) => !buscar.trim() || normalizar(`${l.nombre} ${l.direccion ?? ""} ${l.parroquia ?? ""}`).includes(normalizar(buscar.trim())))
        .sort((a, b) => a.concello.localeCompare(b.concello) || a.nombre.localeCompare(b.nombre)),
    [lugares, concello, buscar],
  );
  const aproximados = lugares.filter((l) => l.aprox).length;

  const c = edicion?.coords.trim() ? parsearCoordenadas(edicion.coords) : null;
  const punto: [number, number] | null = c && !("error" in c) ? [c.lat, c.lng] : null;

  /** El concello cuyo centro está más cerca (para un lugar nuevo creado con un clic en el mapa) */
  function concelloCercano(lat: number, lng: number) {
    let mejor = "";
    let d = Infinity;
    for (const [k, [la, ln]] of Object.entries(centros)) {
      const x = (la - lat) ** 2 + (ln - lng) ** 2;
      if (x < d) [d, mejor] = [x, k];
    }
    return mejor;
  }

  function clicEnMapa(lat: number, lng: number) {
    setMensaje(null);
    const coords = formatoCoordenadas(lat, lng);
    if (edicion) setEdicion({ ...edicion, coords, aprox: false });
    else setEdicion({ nombre: "", concello: concello || concelloCercano(lat, lng), parroquia: "", direccion: "", coords, aprox: false });
  }

  const cambiar = (k: keyof Edicion, v: string | boolean) => edicion && setEdicion({ ...edicion, [k]: v });
  const error = estado.tipo === "error" && edicion ? estado.mensaje : null;

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <MapaLugares lugares={lugares} punto={punto} onClicLugar={(l) => (setMensaje(null), setEdicion(desdeLugar(l)))} onClicMapa={clicEnMapa} />
        <p className="mt-2 text-xs text-[var(--gris)]">
          <span className="text-[#0b5c8a]">●</span> exacto · <span className="text-[#d97706]">●</span> aproximado ({aproximados}) ·{" "}
          <span className="text-red-600">●</span> el que editas. {edicion ? "Haz clic en el mapa para moverlo." : "Clic en un punto para editarlo, o en el mapa para crear uno nuevo ahí."}
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        {mensaje && (
          <p role="status" className="rounded-xl bg-[var(--arena)] p-3 text-sm">
            ✓ {mensaje}
          </p>
        )}

        {edicion ? (
          <form action={accion} className="space-y-3 rounded-2xl border border-[var(--tinta)] bg-white p-4">
            <h2 className="font-medium">{edicion.anterior ? `Editar «${edicion.anterior.nombre}»` : "Nuevo lugar"}</h2>
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-900">
                {error}
              </p>
            )}
            <input type="hidden" name="anterior_nombre" value={edicion.anterior?.nombre ?? ""} />
            <input type="hidden" name="anterior_concello" value={edicion.anterior?.concello ?? ""} />
            <label className="block">
              <span className="text-sm">Nombre</span>
              <input name="nombre" value={edicion.nombre} onChange={(e) => cambiar("nombre", e.target.value)} required placeholder="Auditorio Municipal de Nigrán" className={campo} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm">Concello</span>
                <select name="concello" value={edicion.concello} onChange={(e) => cambiar("concello", e.target.value)} required className={campo}>
                  <option value="">Elige…</option>
                  {[...new Set([...concellos, edicion.concello].filter(Boolean))].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm">Parroquia (opcional)</span>
                <input name="parroquia" value={edicion.parroquia} onChange={(e) => cambiar("parroquia", e.target.value)} list="parroquias-lugar" className={campo} />
                <datalist id="parroquias-lugar">
                  {(parroquias[edicion.concello] ?? []).map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
            </div>
            <label className="block">
              <span className="text-sm">Dirección (opcional)</span>
              <input name="direccion" value={edicion.direccion} onChange={(e) => cambiar("direccion", e.target.value)} className={campo} />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
              <label className="block">
                <span className="text-sm">Coordenadas</span>
                <input
                  name="coords"
                  value={edicion.coords}
                  onChange={(e) => setEdicion({ ...edicion, coords: e.target.value, aprox: false })}
                  required
                  inputMode="decimal"
                  placeholder="42.1115, -8.7608"
                  aria-invalid={!!(c && "error" in c)}
                  className={`${campo} ${c && "error" in c ? "border-red-400" : ""}`}
                />
              </label>
              <label className="block">
                <span className="text-sm">Precisión</span>
                <select name="aprox" value={edicion.aprox ? "1" : "0"} onChange={(e) => cambiar("aprox", e.target.value === "1")} className={campo}>
                  <option value="0">Exacta</option>
                  <option value="1">Aproximada</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-[var(--gris)]">
              {c && "error" in c ? <span className="text-red-700">{c.error}. </span> : null}
              Pega las de Google Maps o haz clic en el mapa.{" "}
              <a
                href={punto ? enlaceCoordenadas(punto[0], punto[1]) : enlaceBuscarSitio(edicion.nombre || "sitio", edicion.concello)}
                target="_blank"
                rel="noopener"
                className="text-[var(--mar)] underline"
              >
                {punto ? "Ver en Google Maps" : "Buscar en Google Maps"}
              </a>
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button disabled={guardando} className="flex-1 rounded-full bg-[var(--mar)] px-4 py-2 font-medium text-white disabled:opacity-60">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={() => setEdicion(null)} className={boton}>
                Cancelar
              </button>
              {edicion.anterior && (
                <button
                  type="button"
                  onClick={async () => {
                    const ant = edicion.anterior!;
                    if (!confirm(`¿Borrar «${ant.nombre}» de los lugares habituales? Los eventos que ya lo usan no cambian.`)) return;
                    await borrarLugar(ant.nombre, ant.concello);
                    setEdicion(null);
                    setMensaje(`Borrado «${ant.nombre}».`);
                  }}
                  className="rounded-full border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Borrar
                </button>
              )}
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => (setMensaje(null), setEdicion({ nombre: "", concello, parroquia: "", direccion: "", coords: "", aprox: false }))}
            className="w-full rounded-full bg-[var(--tinta)] px-4 py-2 font-medium text-white"
          >
            + Añadir un lugar
          </button>
        )}

        {sugerencias.length > 0 && (
          <details className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm" open={!edicion}>
            <summary className="cursor-pointer font-medium">Salen en eventos y aún no son habituales ({sugerencias.length})</summary>
            <ul className="mt-2 space-y-1.5">
              {sugerencias.map((s) => (
                <li key={`${s.concello}|${s.nombre}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {s.nombre} <span className="text-[var(--gris)]">· {s.concello} · {s.usos} {s.usos === 1 ? "evento" : "eventos"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      (setMensaje(null),
                      setEdicion({ nombre: s.nombre, concello: s.concello, parroquia: "", direccion: s.direccion ?? "", coords: formatoCoordenadas(s.lat, s.lng), aprox: s.aprox }))
                    }
                    className={boton}
                  >
                    Situar
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex gap-2">
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" aria-label="Buscar lugar" className={campo} />
          <select value={concello} onChange={(e) => setConcello(e.target.value)} aria-label="Concello" className={`${campo} w-40`}>
            <option value="">Todos</option>
            {concellos.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <ul className="space-y-1.5">
          {visibles.map((l) => {
            const n = usos[claveLugar(l.nombre, l.concello)] ?? 0;
            const activo = edicion?.anterior && claveLugar(edicion.anterior.nombre, edicion.anterior.concello) === claveLugar(l.nombre, l.concello);
            return (
              <li key={`${l.concello}|${l.nombre}`}>
                <button
                  type="button"
                  onClick={() => (setMensaje(null), setEdicion(desdeLugar(l)))}
                  className={`flex w-full items-start gap-2 rounded-xl border p-2.5 text-left text-sm ${activo ? "border-[var(--tinta)] bg-[var(--arena)]" : "border-[var(--linea)] bg-white hover:border-[var(--tinta)]"}`}
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${l.aprox ? "bg-[#d97706]" : "bg-[#0b5c8a]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.nombre}</span>
                    <span className="block truncate text-xs text-[var(--gris)]">
                      {l.concello}
                      {l.parroquia ? ` · ${l.parroquia}` : ""}
                      {l.direccion ? ` · ${l.direccion}` : ""}
                      {l.aprox ? " · aproximado" : ""}
                    </span>
                  </span>
                  {n > 0 && <span className="shrink-0 text-xs text-[var(--gris)]">{n} ev.</span>}
                </button>
              </li>
            );
          })}
          {!visibles.length && <li className="py-4 text-center text-sm text-[var(--gris)]">Ningún lugar con este filtro.</li>}
        </ul>
      </div>
    </div>
  );
}
