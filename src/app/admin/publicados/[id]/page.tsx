import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { almacen } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { apoyoFormulario, valoresDe } from "@/lib/admin/valores";
import { eventosDelRepositorio } from "@/lib/eventos";
import FormularioRevision from "../../[id]/FormularioRevision";
import { retirarPublicado } from "../../acciones";
import BotonRetirar from "./BotonRetirar";

export default function EditarPublicado({ params, searchParams }: PageProps<"/admin/publicados/[id]">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/publicados/[id]">, "params" | "searchParams">) {
  await exigirAdmin();
  const { id } = await params;
  const { guardado } = await searchParams;
  const a = almacen();
  const esGit = id.startsWith("git.") && a.tipo !== "local";
  const e = esGit ? eventosDelRepositorio().find((x) => x.slug === id.slice(4)) : (await a.publicado(id))?.evento;
  if (!e) notFound();

  return (
    <>
      <Link href="/admin/publicados" className="text-sm text-[var(--gris)] hover:underline">
        ← Publicados
      </Link>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl">{e.titulo}</h1>
      <p className="mt-2 text-sm">
        <Link href={`/evento/${e.slug}`} target="_blank" className="text-[var(--mar)] underline">
          Ver en la web →
        </Link>
        <span className="text-[var(--gris)]"> · dirección /evento/{e.slug} (no cambia al editar)</span>
      </p>
      {guardado && <p className="mt-3 rounded-xl bg-[var(--arena)] p-3 text-sm">Guardado. La web se actualiza en unos segundos.</p>}
      {esGit && (
        <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
          Este evento está en el repositorio (<code>data/eventos</code>). Al guardar cambios se copia a la base de datos y desde entonces se edita desde aquí; el
          de <code>data/eventos</code> queda sustituido.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <FormularioRevision modo="publicado" id={id} valores={valoresDe(e)} {...(await apoyoFormulario(a))} cartelActual={e.cartel} />
        <aside className="order-first md:order-none">
          {e.cartel ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--linea)] bg-white">
              <Image src={e.cartel} alt={`Cartel: ${e.titulo}`} width={520} height={700} unoptimized className="h-auto w-full" />
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--linea)] p-4 text-sm text-[var(--gris)]">Sin cartel. Puedes añadir una imagen en el formulario, en «Añadir un cartel».</p>
          )}
          <BotonRetirar accion={retirarPublicado.bind(null, id)} />
        </aside>
      </div>
    </>
  );
}
