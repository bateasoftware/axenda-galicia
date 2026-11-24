import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { almacen, almacenDisponible } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { eventosDelRepositorio, slugConcello, todosLosEventos } from "@/lib/eventos";
import { capitalizar, dia, fechaCorta, fechaHoraGalicia, haTerminado, hora, primerInicio, ultimoFin } from "@/lib/fechas";
import type { Evento } from "@/lib/tipos";

export default function Publicados({ searchParams }: PageProps<"/admin/publicados">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando publicados…</p>}>
      <Lista searchParams={searchParams} />
    </Suspense>
  );
}

type Fila = { id: string; evento: Evento; repo: boolean };

async function Lista({ searchParams }: Pick<PageProps<"/admin/publicados">, "searchParams">) {
  await exigirAdmin();
  await connection();
  if (!almacenDisponible()) return <p className="mt-6">Falta configurar la base de datos (ver docs/pendientes-juan.md).</p>;
  const { retirado, concello: filtro } = await searchParams;
  const a = almacen();

  // Lo que se ve en la web: de la base de datos (editable) y los de data/eventos que no están retirados ni sustituidos
  const enNube = a.tipo === "local" ? [] : await a.publicadosConId();
  const slugsNube = new Set(enNube.map((x) => x.evento.slug));
  const enWeb = new Set((await todosLosEventos()).map((e) => e.slug));
  const filas: Fila[] =
    a.tipo === "local"
      ? (await a.publicadosConId()).map((x) => ({ ...x, repo: false }))
      : [
          ...enNube.map((x) => ({ ...x, repo: false })),
          ...eventosDelRepositorio()
            .filter((e) => !slugsNube.has(e.slug) && enWeb.has(e.slug))
            .map((e) => ({ id: `git.${e.slug}`, evento: e, repo: true })),
        ];

  const ahora = fechaHoraGalicia();
  const concellos = [...new Set(filas.map((f) => f.evento.concello))].sort();
  const visibles = filas.filter((f) => !filtro || slugConcello(f.evento.concello) === filtro);
  const proximos = visibles.filter((f) => !haTerminado(ultimoFin(f.evento), ahora)).sort((x, y) => primerInicio(x.evento).localeCompare(primerInicio(y.evento)));
  const pasados = visibles.filter((f) => haTerminado(ultimoFin(f.evento), ahora)).sort((x, y) => primerInicio(y.evento).localeCompare(primerInicio(x.evento)));

  return (
    <>
      <Link href="/admin" className="text-sm text-[var(--gris)] hover:underline">
        ← Pendientes
      </Link>
      <h1 className="mt-2 font-display text-3xl">Publicados ({filas.length})</h1>
      <p className="mt-1 text-sm text-[var(--gris)]">Los eventos que ahora mismo se ven en la web. Entra en uno para editarlo o retirarlo.</p>
      {retirado && <p className="mt-4 rounded-xl bg-[var(--arena)] p-3 text-sm">Retirado de la web. Desaparece en unos segundos.</p>}
      {concellos.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/admin/publicados" className={`rounded-full border px-3 py-1 ${!filtro ? "border-[var(--tinta)] bg-[var(--arena)]" : "border-[var(--linea)] bg-white"}`}>
            Todos
          </Link>
          {concellos.map((c) => (
            <Link
              key={c}
              href={`/admin/publicados?concello=${slugConcello(c)}`}
              className={`rounded-full border px-3 py-1 ${filtro === slugConcello(c) ? "border-[var(--tinta)] bg-[var(--arena)]" : "border-[var(--linea)] bg-white"}`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}
      <Grupo titulo="Próximos y en curso" filas={proximos} vacio="No hay eventos próximos." />
      <Grupo titulo="Pasados" filas={pasados} pasados />
    </>
  );
}

function Grupo({ titulo, filas, vacio, pasados = false }: { titulo: string; filas: Fila[]; vacio?: string; pasados?: boolean }) {
  if (!filas.length && !vacio) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">
        {titulo} ({filas.length})
      </h2>
      {!filas.length && <p className="mt-2 text-sm text-[var(--gris)]">{vacio}</p>}
      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
        {filas.map(({ id, evento: e, repo }) => {
          const ini = primerInicio(e);
          return (
            <li key={id}>
              <Link href={`/admin/publicados/${id}`} className={`flex items-center justify-between gap-3 rounded-2xl border border-[var(--linea)] bg-white p-3 hover:shadow-md ${pasados ? "opacity-70" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.titulo}</span>
                  <span className="block text-sm text-[var(--gris)]">
                    {capitalizar(fechaCorta(ini))}
                    {hora(ini) ? ` · ${hora(ini)}` : ""}
                    {e.sesiones.at(-1)?.fin && dia(e.sesiones.at(-1)!.fin!) !== dia(ini) ? ` → ${fechaCorta(e.sesiones.at(-1)!.fin!)}` : ""} · {e.concello}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--gris)]">{repo ? "Repositorio" : "Editar →"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
