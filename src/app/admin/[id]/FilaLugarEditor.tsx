"use client";

import { useState, useSyncExternalStore } from "react";
import { enlaceBuscarSitio, enlaceCoordenadas, formatoCoordenadas, parsearCoordenadas } from "@/lib/coordenadas";
import type { FilaLugar } from "@/lib/admin/formulario";
import type { LugarConocido } from "@/lib/lugares";
import { lugaresParecidos } from "@/lib/lugares-parecidos";

const campo = "w-full rounded-xl border border-[var(--linea)] bg-white px-3 py-2 text-[15px]";
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sinSuscripcion = () => () => {};

/** El concello que hay ahora en el formulario (solo en el navegador) */
const concelloActual = () => (typeof document === "undefined" ? "" : (document.querySelector<HTMLInputElement>("input[name=concello]")?.value ?? ""));

/**
 * Un sitio del evento. Al escribir el nombre de un lugar habitual se rellenan solas sus coordenadas (y la dirección);
 * se pueden cambiar pegando las de Google Maps («42.1115, -8.7608»). Con «Guardar como lugar habitual» queda para la próxima vez.
 */
export default function FilaLugarEditor({
  inicial,
  indice,
  conocidos,
  puedeQuitar,
  onQuitar,
}: {
  inicial: FilaLugar;
  indice: number;
  conocidos: LugarConocido[];
  puedeQuitar: boolean;
  onQuitar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [direccion, setDireccion] = useState(inicial.direccion);
  const [coords, setCoords] = useState(inicial.coords);
  const [aprox, setAprox] = useState(inicial.aprox);
  const [guardar, setGuardar] = useState(inicial.guardar);
  // Las coordenadas que se pusieron solas: si siguen siendo estas, cambiar de nombre las vuelve a poner
  const [auto, setAuto] = useState("");
  // Lo que depende del concello escrito en el formulario se calcula solo en el navegador (si no, no coincide con el HTML del servidor)
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const [habitual, setHabitual] = useState<LugarConocido | null>(() => buscar(inicial.nombre, conocidos));

  function buscar(n: string, lista: LugarConocido[]): LugarConocido | null {
    const iguales = lista.filter((l) => normalizar(l.nombre) === normalizar(n) && n.trim());
    if (!iguales.length) return null;
    const concello = normalizar(concelloActual());
    return iguales.find((l) => normalizar(l.concello) === concello) ?? iguales[0];
  }

  function alCambiarNombre(v: string) {
    setNombre(v);
    const m = buscar(v, conocidos);
    setHabitual(m);
    // Se sustituyen si no había, si eran las puestas solas o si eran aproximadas (p. ej. el centro del concello)
    if (m && (!coords.trim() || coords === auto || aprox)) {
      const c = formatoCoordenadas(m.lat, m.lng);
      setCoords(c);
      setAuto(c);
      setAprox(!!m.aprox);
      if (!direccion && m.direccion) setDireccion(m.direccion);
    }
  }

  /** Elegir un lugar habitual sugerido: su nombre, coordenadas y dirección */
  function elegir(l: LugarConocido) {
    const c = formatoCoordenadas(l.lat, l.lng);
    setNombre(l.nombre);
    setHabitual(l);
    setCoords(c);
    setAuto(c);
    setAprox(!!l.aprox);
    if (l.direccion) setDireccion(l.direccion);
    setGuardar(false);
  }

  function alCambiarCoords(v: string) {
    setCoords(v);
    // Si se pegan unas coordenadas distintas de las automáticas, se dan por exactas
    if (v.trim() && v !== auto && !("error" in parsearCoordenadas(v))) setAprox(false);
  }

  const c = coords.trim() ? parsearCoordenadas(coords) : null;
  const error = c && "error" in c ? c.error : null;
  const verEnMaps = c && !("error" in c) ? enlaceCoordenadas(c.lat, c.lng) : enlaceBuscarSitio(nombre || "sitio", montado ? concelloActual() : undefined);
  // Si no es un lugar habitual, los que se llaman parecido (en el mismo concello): quizá es el mismo
  const parecidos = habitual || !montado ? [] : lugaresParecidos(nombre, concelloActual(), conocidos);
  const igualQueElHabitual = habitual && coords === formatoCoordenadas(habitual.lat, habitual.lng);

  return (
    <div className="rounded-xl border border-[var(--linea)] bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-[var(--gris)]">Sitio</span>
          <input name="lug_nombre" value={nombre} onChange={(e) => alCambiarNombre(e.target.value)} list="lugares-conocidos" placeholder="Parque da Ramallosa" className={campo} />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--gris)]">Dirección (opcional)</span>
          <input name="lug_direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={campo} />
        </label>
      </div>
      {parecidos.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          <span className="font-medium">¿Es uno de estos lugares habituales?</span>{" "}
          {parecidos.map((l) => (
            <button
              key={`${l.concello}|${l.nombre}`}
              type="button"
              onClick={() => elegir(l)}
              className="mt-1 mr-1 inline-block rounded-full border border-amber-300 bg-white px-2 py-0.5 text-amber-950 hover:border-amber-600"
            >
              {l.nombre}
            </button>
          ))}
        </div>
      )}
      {habitual && igualQueElHabitual && (
        <p className="mt-2 text-xs text-emerald-800">
          ✓ Lugar habitual de {habitual.concello}: coordenadas puestas{habitual.aprox ? " (aproximadas: afínalas en Lugares)" : ""}.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="block">
          <span className="text-xs text-[var(--gris)]">Coordenadas (opcional): pega las de Google Maps</span>
          <input
            name="lug_coords"
            value={coords}
            onChange={(e) => alCambiarCoords(e.target.value)}
            inputMode="decimal"
            placeholder="42.1115, -8.7608"
            aria-invalid={!!error}
            className={`${campo} ${error ? "border-red-400" : ""}`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--gris)]">Precisión</span>
          <select name="lug_aprox" value={aprox ? "1" : "0"} onChange={(e) => setAprox(e.target.value === "1")} className={campo}>
            <option value="1">Aproximada</option>
            <option value="0">Exacta</option>
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-xs text-[var(--gris)]">
          Vacías = se calculan solas (lugar habitual o centro del concello). En Google Maps: clic derecho sobre el sitio y se copian las coordenadas.{" "}
          <a href={verEnMaps} target="_blank" rel="noopener" className="text-[var(--mar)] underline">
            {c ? "Ver en Google Maps" : "Buscar en Google Maps"}
          </a>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {nombre.trim() && !igualQueElHabitual ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} /> Guardar como lugar habitual
          </label>
        ) : (
          <span />
        )}
        <input type="hidden" name="lug_guardar" value={guardar && !igualQueElHabitual ? "1" : "0"} />
        {puedeQuitar && (
          <button type="button" onClick={onQuitar} className="rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-sm hover:border-[var(--tinta)]" aria-label={`Quitar el lugar ${indice + 1}`}>
            Quitar este sitio
          </button>
        )}
      </div>
    </div>
  );
}
