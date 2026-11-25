"use client";

import { startTransition, useActionState, useState } from "react";
import type { FilaLugar, FilaSesion } from "@/lib/admin/formulario";
import { CATEGORIAS } from "@/lib/categorias";
import { MAX_BYTES_ARCHIVO, reducirImagen } from "@/lib/reducir-imagen";
import { LISTA_CATEGORIAS, type Categoria } from "@/lib/tipos";
import { editarPublicado, revisar, type EstadoRevision } from "../acciones";

export type Valores = {
  slug: string;
  titulo: string;
  titulo_gl: string;
  resumen: string;
  sesiones: FilaSesion[];
  lugares: FilaLugar[];
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
  destacado_hasta: string;
};

const campo = "w-full rounded-xl border border-[var(--linea)] bg-white px-3 py-2 text-[15px]";
const boton = "rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-sm hover:border-[var(--tinta)]";

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{etiqueta}</span>
      {ayuda && <span className="block text-xs text-[var(--gris)]">{ayuda}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/** Filas que se pueden añadir y quitar. Los campos son libres (sin estado): cada fila lleva su clave. */
function useFilas<T>(iniciales: T[], vacia: T) {
  const [filas, setFilas] = useState(() => iniciales.map((f, i) => ({ k: i, f })));
  const [siguiente, setSiguiente] = useState(iniciales.length);
  return {
    filas,
    anadir: () => {
      setFilas((x) => [...x, { k: siguiente, f: { ...vacia } }]);
      setSiguiente(siguiente + 1);
    },
    quitar: (k: number) => setFilas((x) => (x.length > 1 ? x.filter((y) => y.k !== k) : x)),
  };
}

export default function FormularioRevision({
  modo,
  id,
  valores: v,
  concellos,
  parroquias,
  lugaresConocidos,
  cartelActual,
}: {
  modo: "pendiente" | "publicado";
  id: string;
  valores: Valores;
  concellos: string[];
  parroquias: string[];
  lugaresConocidos: string[];
  cartelActual?: string;
}) {
  const accionServidor = modo === "publicado" ? editarPublicado : revisar;
  const [estado, accion, pendiente] = useActionState<EstadoRevision, FormData>(accionServidor.bind(null, id), { tipo: "inicial" });
  const sesiones = useFilas<FilaSesion>(v.sesiones, { dia: "", hora: "", finDia: "", finHora: "", nota: "" });
  const lugares = useFilas<FilaLugar>(v.lugares, { nombre: "", direccion: "", lat: "", lng: "", aprox: true });
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorLocal(null);
    // Con onSubmit (y no action) React no vacía el formulario al terminar: no se pierden los cambios si hay errores
    const datos = new FormData(ev.currentTarget, (ev.nativeEvent as SubmitEvent).submitter);
    const cartel = datos.get("cartel");
    if (cartel instanceof File && cartel.size) {
      if (!cartel.type.startsWith("image/")) return setErrorLocal("El cartel tiene que ser una imagen (JPG, PNG o WebP).");
      const reducido = await reducirImagen(cartel);
      if (reducido.size > MAX_BYTES_ARCHIVO) return setErrorLocal("El cartel pasa de 4 MB. Prueba con una imagen más ligera.");
      datos.set("cartel", reducido, cartel.name);
    } else datos.delete("cartel");
    startTransition(() => accion(datos));
  }

  const errores = errorLocal ? [errorLocal] : estado.tipo === "errores" ? estado.errores : [];

  return (
    <form onSubmit={enviar} className="space-y-4">
      <input type="hidden" name="slug" value={v.slug} />
      {errores.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">Revisa esto:</p>
          <ul className="mt-1 list-inside list-disc">
            {errores.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {estado.tipo === "guardado" && !errorLocal && (
        <div role="status" className="rounded-xl bg-[var(--arena)] p-3 text-sm">
          <p className="font-medium">{estado.enWeb ? "Guardado. La web se actualiza en unos segundos." : "Guardado."}</p>
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

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Cuándo</legend>
        <p className="text-xs text-[var(--gris)]">
          La hora es opcional: si es una exposición, una feria o dura varios días, déjala vacía. Si dura varios días, pon el último día en «Hasta el día».
        </p>
        {sesiones.filas.map(({ k, f }, i) => (
          <div key={k} className="rounded-xl border border-[var(--linea)] bg-white p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="text-xs text-[var(--gris)]">Día</span>
                <input type="date" name="ses_dia" defaultValue={f.dia} className={campo} />
              </label>
              <label className="block">
                <span className="text-xs text-[var(--gris)]">Hora (opcional)</span>
                <input type="time" name="ses_hora" defaultValue={f.hora} className={campo} />
              </label>
              <label className="block">
                <span className="text-xs text-[var(--gris)]">Hasta el día (opcional)</span>
                <input type="date" name="ses_fin_dia" defaultValue={f.finDia} className={campo} />
              </label>
              <label className="block">
                <span className="text-xs text-[var(--gris)]">Hora de fin (opcional)</span>
                <input type="time" name="ses_fin_hora" defaultValue={f.finHora} className={campo} />
              </label>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <label className="block flex-1">
                <span className="text-xs text-[var(--gris)]">Nota (opcional): qué pasa en esta sesión</span>
                <input name="ses_nota" defaultValue={f.nota} className={campo} />
              </label>
              {sesiones.filas.length > 1 && (
                <button type="button" onClick={() => sesiones.quitar(k)} className={boton} aria-label={`Quitar la sesión ${i + 1}`}>
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={sesiones.anadir} className={boton}>
          + Añadir otro día u horario
        </button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Concello">
          <input name="concello" defaultValue={v.concello} list="concellos" required className={campo} />
          <datalist id="concellos">
            {concellos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Parroquia (opcional)">
          <input name="parroquia" defaultValue={v.parroquia} list="parroquias" className={campo} />
          <datalist id="parroquias">
            {parroquias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Dónde</legend>
        <p className="text-xs text-[var(--gris)]">
          Escribe solo el nombre del sitio. Si es uno conocido se pone su ubicación; si no, se usa el centro del concello (aproximada) y puedes afinarla en
          «Coordenadas».
        </p>
        {lugares.filas.map(({ k, f }, i) => (
          <div key={k} className="rounded-xl border border-[var(--linea)] bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[var(--gris)]">Sitio</span>
                <input name="lug_nombre" defaultValue={f.nombre} list="lugares-conocidos" placeholder="Parque da Ramallosa" className={campo} />
              </label>
              <label className="block">
                <span className="text-xs text-[var(--gris)]">Dirección (opcional)</span>
                <input name="lug_direccion" defaultValue={f.direccion} className={campo} />
              </label>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-[var(--mar)]">Coordenadas (opcional)</summary>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--gris)]">Latitud</span>
                  <input name="lug_lat" defaultValue={f.lat} inputMode="decimal" placeholder="42.1115" className={campo} />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--gris)]">Longitud</span>
                  <input name="lug_lng" defaultValue={f.lng} inputMode="decimal" placeholder="-8.7608" className={campo} />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--gris)]">Precisión</span>
                  <select name="lug_aprox" defaultValue={f.aprox ? "1" : "0"} className={campo}>
                    <option value="1">Aproximada</option>
                    <option value="0">Exacta</option>
                  </select>
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--gris)]">Si las dejas vacías se calculan solas. En Google Maps: clic derecho sobre el sitio y se copian las coordenadas.</p>
            </details>
            {lugares.filas.length > 1 && (
              <button type="button" onClick={() => lugares.quitar(k)} className={`${boton} mt-2`} aria-label={`Quitar el lugar ${i + 1}`}>
                Quitar este sitio
              </button>
            )}
          </div>
        ))}
        <datalist id="lugares-conocidos">
          {lugaresConocidos.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <button type="button" onClick={lugares.anadir} className={boton}>
          + Añadir otro sitio
        </button>
      </fieldset>

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

      <Campo
        etiqueta={cartelActual ? "Cambiar el cartel" : "Añadir un cartel"}
        ayuda={cartelActual ? "Elige una imagen para sustituir el actual" : "Este evento no tiene cartel: puedes subir una imagen (JPG, PNG o WebP)"}
      >
        <input name="cartel" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" />
      </Campo>

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
          {modo === "pendiente" && (
            <Campo etiqueta="Deducido (pendiente de comprobar)" ayuda="Borra las líneas que ya hayas comprobado">
              <textarea name="inferido" defaultValue={v.inferido} rows={2} className={campo} />
            </Campo>
          )}
          <Campo etiqueta="Idioma del cartel">
            <select name="idioma" defaultValue={v.idioma} className={campo}>
              <option value="gl">Gallego</option>
              <option value="es">Castellano</option>
              <option value="mixto">Mixto</option>
            </select>
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recurrente" defaultChecked={v.recurrente} /> Se repite cada año
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="comercial" defaultChecked={v.comercial} /> Promoción de un negocio
          </label>
          <Campo etiqueta="Destacado hasta (incluido)" ayuda="Para destacados de pago: sale marcado como «Destacado» hasta ese día y sus cifras se miden aparte. Vacío = normal">
            <input name="destacado_hasta" type="date" defaultValue={v.destacado_hasta} className={campo} />
          </Campo>
        </div>
      </details>

      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-[var(--fondo)]/95 px-1 py-3 backdrop-blur">
        {modo === "pendiente" ? (
          <>
            <button name="accion" value="publicar" disabled={pendiente} className="flex-1 rounded-full bg-[var(--mar)] px-4 py-2.5 font-medium text-white disabled:opacity-60">
              {pendiente ? "Un momento…" : "Publicar"}
            </button>
            <button name="accion" value="guardar" disabled={pendiente} className="rounded-full border border-[var(--linea)] bg-white px-4 py-2.5 font-medium disabled:opacity-60">
              Guardar
            </button>
          </>
        ) : (
          <button name="accion" value="guardar" disabled={pendiente} className="flex-1 rounded-full bg-[var(--mar)] px-4 py-2.5 font-medium text-white disabled:opacity-60">
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </div>
    </form>
  );
}
