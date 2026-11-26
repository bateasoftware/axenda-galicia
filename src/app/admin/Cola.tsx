import Image from "next/image";
import Link from "next/link";
import CartelGenerico from "@/components/CartelGenerico";
import type { Pendiente } from "@/lib/almacen";
import { consultaFiltro, esDuplicado, esPorCompletar, type FiltroCola } from "@/lib/admin/cola";
import { capitalizar, fechaLarga, hora } from "@/lib/fechas";

/** Cola de pendientes en columna estrecha: a la izquierda del editor en pantallas grandes, para revisar uno tras otro sin volver a la lista. */
export default function Cola({ cola, actual, filtro, total }: { cola: Pendiente[]; actual: string; filtro: FiltroCola; total: number }) {
  const consulta = consultaFiltro(filtro);
  return (
    <nav aria-label="Pendientes" className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
      <div className="flex items-baseline justify-between gap-2 pb-2">
        <h2 className="text-sm font-medium">
          Pendientes ({cola.length}
          {cola.length !== total ? ` de ${total}` : ""})
        </h2>
        <Link href={`/admin${consulta}`} prefetch={false} className="text-xs text-[var(--gris)] hover:underline">
          Lista
        </Link>
      </div>
      {consulta && (
        <p className="pb-2 text-xs text-[var(--gris)]">
          Con filtro:{" "}
          <Link href={`/admin/${actual}`} prefetch={false} className="underline">
            quitar
          </Link>
        </p>
      )}
      <ul className="space-y-1.5">
        {cola.map((p) => {
          const e = p.evento;
          const ini = e.sesiones[0]?.inicio;
          const activo = p.id === actual;
          return (
            <li key={p.id}>
              <Link
                href={`/admin/${p.id}${consulta}`}
                prefetch={false}
                aria-current={activo ? "page" : undefined}
                className={`flex gap-2 rounded-xl border p-2 text-sm ${activo ? "border-[var(--tinta)] bg-[var(--arena)]" : "border-[var(--linea)] bg-white hover:border-[var(--tinta)]"}`}
              >
                <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-[var(--arena)]">
                  {p.cartel ? (
                    <Image src={p.cartel} alt="" fill sizes="36px" unoptimized className="object-cover" />
                  ) : e.categorias?.length ? (
                    <CartelGenerico categorias={e.categorias} className="absolute inset-0 h-full w-full opacity-80" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.titulo || "(sin título)"}</span>
                  <span className="block truncate text-xs text-[var(--gris)]">
                    {ini ? `${capitalizar(fechaLarga(ini))}${hora(ini) ? ` · ${hora(ini)}` : ""}` : "sin fecha"} · {e.concello || "sin concello"}
                  </span>
                  {(esDuplicado(p) || esPorCompletar(p)) && (
                    <span className="block text-xs font-medium">
                      {esDuplicado(p) && <span className="text-red-700">⚠ duplicado </span>}
                      {esPorCompletar(p) && <span className="text-[var(--mar)]">✍️ completar</span>}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
