"use client";

import { startTransition, useActionState, useState } from "react";
import { CATEGORIAS } from "@/lib/categorias";
import { LISTA_CATEGORIAS, type Categoria } from "@/lib/tipos";
import { revisar, type EstadoRevision } from "../acciones";

type Valores = {
  slug: string;
  titulo: string;
  titulo_gl: string;
  resumen: string;
  sesiones: string;
  lugares: string;
  concello: string;
  parroquia: string;
  organizadores: string;
  categorias: Categoria[];
  publico: string;
  precio: string;
  idioma: "gl" | "es" | "mixto";
  inscripcion_url: string;
  inscripcion_telefono: string;
  inscripcion_email: string;
  inscripcion_hasta: string;
  extras: string;
  inferido: string;
  recurrente: boolean;
  comercial: boolean;
};

const campo = "w-full rounded-xl border border-[var(--linea)] bg-white px-3 py-2 text-[15px]";

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{etiqueta}</span>
      {ayuda && <span className="block text-xs text-[var(--gris)]">{ayuda}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export default function FormularioRevision({
  id,
  valores: v,
  concellos,
  lugaresConocidos,
}: {
  id: string;
  valores: Valores;
  concellos: string[];
  lugaresConocidos: string[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoRevision, FormData>(revisar.bind(null, id), { tipo: "inicial" });
  const [lugares, setLugares] = useState(v.lugares);

  return (
    <form
      // Con onSubmit (y no action) React no vacía el formulario al terminar: no se pierden los cambios si hay errores
      onSubmit={(ev) => {
        ev.preventDefault();
        const datos = new FormData(ev.currentTarget, (ev.nativeEvent as SubmitEvent).submitter);
        startTransition(() => accion(datos));
      }}
      className="space-y-4"
    >
      {estado.tipo === "errores" && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">Revisa esto:</p>
          <ul className="mt-1 list-inside list-disc">
            {estado.errores.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {estado.tipo === "guardado" && (
        <div role="status" className="rounded-xl bg-[var(--arena)] p-3 text-sm">
          <p className="font-medium">Guardado.</p>
          {estado.avisos.map((x) => (
            <p key={x}>⚠ {x}</p>
          ))}
        </div>
      )}

      <Campo etiqueta="Título (castellano)">
        <input name="titulo" defaultValue={v.titulo} required className={campo} />
      </Campo>
      <Campo etiqueta="Título en gallego" ayuda="Si el original está en gallego">
        <input name="titulo_gl" defaultValue={v.titulo_gl} className={campo} />
      </Campo>
      <Campo etiqueta="Resumen" ayuda="1-2 frases propias, nunca copiadas de la fuente">
        <textarea name="resumen" defaultValue={v.resumen} rows={3} required className={campo} />
      </Campo>
      <Campo etiqueta="Sesiones" ayuda="Una por línea: 2026-11-22 17:00 · 2026-11-22 17:00 - 19:30 · añade | nota si hay programa">
        <textarea name="sesiones" defaultValue={v.sesiones} rows={Math.max(2, v.sesiones.split("\n").length)} className={`${campo} font-mono text-sm`} />
      </Campo>
      <Campo etiqueta="Lugares" ayuda='Uno por línea: Nombre | lat, lng | dirección | aprox'>
        <textarea name="lugares" value={lugares} onChange={(e) => setLugares(e.target.value)} rows={Math.max(2, lugares.split("\n").length)} className={`${campo} font-mono text-sm`} />
      </Campo>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--mar)]">Usar un lugar conocido</summary>
        <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-[var(--linea)] bg-white">
          {lugaresConocidos.map((l) => (
            <li key={l}>
              <button type="button" onClick={() => setLugares(l)} className="w-full px-3 py-1.5 text-left hover:bg-[var(--arena)]">
                {l.split(" | ")[0]}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Concello">
          <input name="concello" defaultValue={v.concello} list="concellos" required className={campo} />
          <datalist id="concellos">
            {concellos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Parroquia">
          <input name="parroquia" defaultValue={v.parroquia} className={campo} />
        </Campo>
      </div>
      <Campo etiqueta="Organiza" ayuda="Separados por comas">
        <input name="organizadores" defaultValue={v.organizadores} className={campo} />
      </Campo>
      <fieldset>
        <legend className="text-sm font-medium">Categorías</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {LISTA_CATEGORIAS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 rounded-full border border-[var(--linea)] bg-white px-3 py-1 text-sm has-[:checked]:border-[var(--tinta)] has-[:checked]:bg-[var(--arena)]">
              <input type="checkbox" name="categorias" value={c} defaultChecked={v.categorias.includes(c)} className="sr-only" />
              {CATEGORIAS[c].emoji} {CATEGORIAS[c].nombre}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Para quién">
          <input name="publico" defaultValue={v.publico} className={campo} />
        </Campo>
        <Campo etiqueta="Precio">
          <input name="precio" defaultValue={v.precio} placeholder="Gratis, 5 €…" className={campo} />
        </Campo>
      </div>
      <details className="rounded-xl border border-[var(--linea)] bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium">Inscripción, extras y más</summary>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Inscripción: web">
              <input name="inscripcion_url" type="url" defaultValue={v.inscripcion_url} className={campo} />
            </Campo>
            <Campo etiqueta="Inscripción: teléfono">
              <input name="inscripcion_telefono" defaultValue={v.inscripcion_telefono} className={campo} />
            </Campo>
            <Campo etiqueta="Inscripción: email">
              <input name="inscripcion_email" type="email" defaultValue={v.inscripcion_email} className={campo} />
            </Campo>
            <Campo etiqueta="Inscripción: hasta">
              <input name="inscripcion_hasta" type="date" defaultValue={v.inscripcion_hasta} className={campo} />
            </Campo>
          </div>
          <Campo etiqueta="Además" ayuda="Una cosa por línea (sorteos, food trucks…)">
            <textarea name="extras" defaultValue={v.extras} rows={2} className={campo} />
          </Campo>
          <Campo etiqueta="Deducido (pendiente de comprobar)" ayuda="Borra las líneas que ya hayas comprobado">
            <textarea name="inferido" defaultValue={v.inferido} rows={2} className={campo} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Slug (dirección de la página)">
              <input name="slug" defaultValue={v.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${campo} font-mono text-sm`} />
            </Campo>
            <Campo etiqueta="Idioma del cartel">
              <select name="idioma" defaultValue={v.idioma} className={campo}>
                <option value="gl">Gallego</option>
                <option value="es">Castellano</option>
                <option value="mixto">Mixto</option>
              </select>
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recurrente" defaultChecked={v.recurrente} /> Se repite cada año
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="comercial" defaultChecked={v.comercial} /> Promoción de un negocio
          </label>
        </div>
      </details>

      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-[var(--fondo)]/95 px-1 py-3 backdrop-blur">
        <button name="accion" value="publicar" disabled={pendiente} className="flex-1 rounded-full bg-[var(--mar)] px-4 py-2.5 font-medium text-white disabled:opacity-60">
          {pendiente ? "Un momento…" : "Publicar"}
        </button>
        <button name="accion" value="guardar" disabled={pendiente} className="rounded-full border border-[var(--linea)] bg-white px-4 py-2.5 font-medium disabled:opacity-60">
          Guardar
        </button>
      </div>
    </form>
  );
}
