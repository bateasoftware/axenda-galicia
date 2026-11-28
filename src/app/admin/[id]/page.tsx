import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { almacen, type Pendiente } from "@/lib/almacen";
import { consultaFiltro, filtrarCola, filtroSeguro, ordenarCola, vecinos } from "@/lib/admin/cola";
import { busquedasDe, enlaceOrigen, sinHora } from "@/lib/admin/origen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { apoyoFormulario, valoresDe } from "@/lib/admin/valores";
import { MARCA_POR_COMPLETAR } from "@/lib/sin-ia";
import { validarEvento } from "@/lib/validacion";
import { descartar } from "../acciones";
import Cola from "../Cola";
import EnlaceDuplicado from "../EnlaceDuplicado";
import FormularioRevision from "./FormularioRevision";

export default function Revisar({ params, searchParams }: PageProps<"/admin/[id]">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/[id]">, "params" | "searchParams">) {
  await exigirAdmin();
  const { id } = await params;
  const q = await searchParams;
  const un = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtro = filtroSeguro(un(q.emisor), un(q.ver));
  const a = almacen();
  const [p, todos] = await Promise.all([a.pendiente(id), a.pendientes()]);
  if (!p) notFound();
  const e = p.evento;
  const v = validarEvento(e, null);
  const apoyo = await apoyoFormulario(a);
  const cola = filtrarCola(ordenarCola(todos), filtro);
  const { anterior, siguiente, indice } = vecinos(cola, id);
  const consulta = consultaFiltro(filtro);
  const hrefDe = (x?: Pendiente) => (x ? `/admin/${x.id}${consulta}` : undefined);
  const publicadoAhora = un(q.publicado);
  const aviso = un(q.guardado) ? "Guardado." : un(q.descartado) ? "Descartado." : publicadoAhora && /^[a-z0-9-]+$/.test(publicadoAhora) ? publicadoAhora : null;

  return (
    <div className="lg:relative lg:left-1/2 lg:w-[min(calc(100vw-3rem),80rem)] lg:-translate-x-1/2 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6">
      <Cola cola={cola} actual={id} filtro={filtro} total={todos.length} />
      <div className="min-w-0">
      {aviso && (
        <p role="status" className="mb-3 rounded-xl bg-[var(--arena)] p-3 text-sm">
          {aviso === publicadoAhora ? (
            <>
              ✓ Publicado.{" "}
              <Link href={`/evento/${aviso}`} target="_blank" className="underline">
                Ver el evento
              </Link>
            </>
          ) : (
            `✓ ${aviso}`
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/admin${consulta}`} className="text-[var(--gris)] hover:underline">
          ← Pendientes
        </Link>
        {indice >= 0 && (
          <span className="flex items-center gap-1 text-[var(--gris)]">
            {hrefDe(anterior) ? (
              <Link href={hrefDe(anterior)!} prefetch={false} className="rounded-full border border-[var(--linea)] bg-white px-3 py-1 hover:border-[var(--tinta)]" title="Alt + ↑">
                ↑ Anterior
              </Link>
            ) : null}
            <span className="px-1">
              {indice + 1} de {cola.length}
            </span>
            {hrefDe(siguiente) && siguiente?.id !== id ? (
              <Link href={hrefDe(siguiente)!} prefetch={false} className="rounded-full border border-[var(--linea)] bg-white px-3 py-1 hover:border-[var(--tinta)]" title="Alt + ↓">
                Siguiente ↓
              </Link>
            ) : null}
          </span>
        )}
      </div>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl">{e.titulo || "(sin título)"}</h1>

      <section className="mt-4 space-y-2 text-sm">
        <p className="text-[var(--gris)]">
          Llegó por <b>{e.fuente.canal}</b> el {e.fuente.recibido.replace("T", " a las ")}
          {e.fuente.id_fuente && <> · fuente {e.fuente.id_fuente}</>}
          {" · "}confianza {Math.round(e.confianza * 100)} %
        </p>
        <Comprobar e={e} conCartel={!!p.cartel} />
        {p.contacto && (
          <p className="rounded-xl bg-[var(--arena)] p-3">
            {p.contacto.canal === "whatsapp" ? "💬 Lo envió alguien por WhatsApp: se le avisará al publicar." : "✉️ Lo envió alguien por email: al publicar verás el mensaje para avisarle."}
          </p>
        )}
        {p.duplicados.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
            <p className="font-medium">⚠ Posible duplicado de:</p>
            <ul className="mt-1 list-inside list-disc">
              {p.duplicados.map((d) => (
                <li key={d}>
                  <EnlaceDuplicado refDup={d} />
                </li>
              ))}
            </ul>
            <p className="mt-1">Si es el mismo evento, descarta este (o completa el publicado si trae algo nuevo).</p>
          </div>
        )}
        {e.inferido?.includes(MARCA_POR_COMPLETAR) && (
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            ✍️ Llegó sin extraer (no está la API de Claude). Rellena título, resumen, sesiones, lugar, concello y categorías mirando el cartel. Lo que te
            escribieron está abajo en «Deducido»: bórralo al terminar (no se publica nunca).
          </p>
        )}
        {e.confianza < 0.8 && !e.inferido?.includes(MARCA_POR_COMPLETAR) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3">⚠ Confianza baja: revisa fecha, hora y lugar con el cartel.</p>}
        {e.inferido?.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="font-medium">⚠ Deducido, no leído literalmente:</p>
            <ul className="mt-1 list-inside list-disc">
              {e.inferido.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!v.ok && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
            <p className="font-medium">Hay que corregir antes de publicar:</p>
            <ul className="mt-1 list-inside list-disc">
              {v.errores.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)]">
        <FormularioRevision
          modo="pendiente"
          id={p.id}
          valores={valoresDe(e)}
          {...apoyo}
          cartelActual={p.cartel}
          filtro={filtro}
          hayOtros={!!siguiente && siguiente.id !== id}
          hrefAnterior={hrefDe(anterior)}
          hrefSiguiente={siguiente && siguiente.id !== id ? hrefDe(siguiente) : undefined}
        />
        <aside className="order-first md:sticky md:top-4 md:order-none md:max-h-[calc(100dvh-2rem)] md:self-start md:overflow-y-auto">
          {p.cartel ? (
            <a href={p.cartel} target="_blank" className="block overflow-hidden rounded-2xl border border-[var(--linea)] bg-white">
              <Image src={p.cartel} alt={`Cartel: ${e.titulo}`} width={520} height={700} unoptimized className="h-auto w-full" />
            </a>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--linea)] p-4 text-sm text-[var(--gris)]">Sin cartel. Puedes añadir una imagen en el formulario, en «Añadir un cartel».</p>
          )}
          <form action={descartar.bind(null, p.id)} className="mt-4">
            {filtro.emisor && <input type="hidden" name="emisor" value={filtro.emisor} />}
            {filtro.ver && <input type="hidden" name="ver" value={filtro.ver} />}
            <button className="w-full rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Descartar</button>
          </form>
        </aside>
      </div>
      </div>
    </div>
  );
}

/** Para validar lo que llega sin cartel: la página original, su atribución y búsquedas ya rellenadas */
function Comprobar({ e, conCartel }: { e: Pendiente["evento"]; conCartel: boolean }) {
  const origen = enlaceOrigen(e);
  const { general, oficial } = busquedasDe(e);
  const boton = "inline-flex items-center gap-1 rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 font-medium hover:border-[var(--tinta)]";
  return (
    <div className="rounded-xl border border-[var(--linea)] bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {origen && (
          <a href={origen} target="_blank" rel="noopener noreferrer" className={boton}>
            🔗 Página original <span className="font-normal text-[var(--gris)]">({new URL(origen).hostname.replace(/^www\./, "")})</span>
          </a>
        )}
        <a href={general} target="_blank" rel="noopener noreferrer" className={boton} title="Título, fecha y lugar">
          🔍 Buscar en Google
        </a>
        {oficial && (
          <a href={oficial.url} target="_blank" rel="noopener noreferrer" className={boton}>
            🏛 Buscar en {oficial.sitio}
          </a>
        )}
      </div>
      {!origen && !conCartel && <p className="mt-2 text-[var(--gris)]">Sin cartel ni enlace de origen: compruébalo con la búsqueda antes de publicar.</p>}
      {sinHora(e) && <p className="mt-2 font-medium text-amber-800">🕒 Sin hora: la fuente no la da. Búscala y ponla en la sesión, o publícalo como evento de todo el día.</p>}
      {e.fuente.atribucion && <p className="mt-2 text-xs text-[var(--gris)]">Atribución (sale en la ficha): {e.fuente.atribucion}</p>}
    </div>
  );
}
