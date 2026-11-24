import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { almacen } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { apoyoFormulario, valoresDe } from "@/lib/admin/valores";
import { MARCA_POR_COMPLETAR } from "@/lib/sin-ia";
import { validarEvento } from "@/lib/validacion";
import { descartar } from "../acciones";
import EnlaceDuplicado from "../EnlaceDuplicado";
import FormularioRevision from "./FormularioRevision";

export default function Revisar({ params }: PageProps<"/admin/[id]">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/[id]">, "params">) {
  await exigirAdmin();
  const { id } = await params;
  const p = await almacen().pendiente(id);
  if (!p) notFound();
  const e = p.evento;
  const v = validarEvento(e, null);

  return (
    <>
      <Link href="/admin" className="text-sm text-[var(--gris)] hover:underline">
        ← Pendientes
      </Link>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl">{e.titulo || "(sin título)"}</h1>

      <section className="mt-4 space-y-2 text-sm">
        <p className="text-[var(--gris)]">
          Llegó por <b>{e.fuente.canal}</b> el {e.fuente.recibido.replace("T", " a las ")}
          {e.fuente.id_fuente && <> · fuente {e.fuente.id_fuente}</>}
          {e.fuente.url && (
            <>
              {" · "}
              <a href={e.fuente.url} target="_blank" rel="noopener" className="underline">
                original
              </a>
            </>
          )}
          {" · "}confianza {Math.round(e.confianza * 100)} %
        </p>
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

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <FormularioRevision modo="pendiente" id={p.id} valores={valoresDe(e)} {...apoyoFormulario} cartelActual={p.cartel} />
        <aside className="order-first md:order-none">
          {p.cartel ? (
            <a href={p.cartel} target="_blank" className="block overflow-hidden rounded-2xl border border-[var(--linea)] bg-white">
              <Image src={p.cartel} alt={`Cartel: ${e.titulo}`} width={520} height={700} unoptimized className="h-auto w-full" />
            </a>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--linea)] p-4 text-sm text-[var(--gris)]">Sin cartel. Puedes añadir una imagen en el formulario, en «Añadir un cartel».</p>
          )}
          <form action={descartar.bind(null, p.id)} className="mt-4">
            <button className="w-full rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Descartar</button>
          </form>
        </aside>
      </div>
    </>
  );
}
