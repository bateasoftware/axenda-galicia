import Link from "next/link";
import Image from "next/image";
import type { Evento } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/categorias";
import { fechaCorta, hora, primerInicio, ultimoFin, dia } from "@/lib/fechas";

export function EtiquetaCategoria({ c }: { c: Evento["categorias"][number] }) {
  const cat = CATEGORIAS[c];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${cat.color}14`, color: cat.color }}
    >
      <span aria-hidden>{cat.emoji}</span>
      {cat.nombre}
    </span>
  );
}

export function TarjetaEvento({ e, pasado = false }: { e: Evento; pasado?: boolean }) {
  const ini = primerInicio(e);
  const fin = ultimoFin(e);
  const variosDias = dia(ini) !== dia(fin);
  return (
    <Link
      href={`/evento/${e.slug}`}
      className={`group flex gap-4 rounded-2xl border border-[var(--linea)] bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md ${pasado ? "opacity-60" : ""}`}
    >
      <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--arena)] sm:h-32 sm:w-28">
        {e.cartel && (
          <Image src={e.cartel} alt={`Cartel: ${e.titulo}`} fill sizes="112px" className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mar)]">
          {fechaCorta(ini)}
          {variosDias && ` – ${fechaCorta(fin)}`}
          {hora(ini) && ` · ${hora(ini)}`}
          {pasado && " · Ya pasó"}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-lg leading-snug text-[var(--tinta)] group-hover:text-[var(--mar)]">
          {e.titulo}
        </h3>
        <p className="mt-1 truncate text-sm text-[var(--gris)]">
          📍 {e.lugares[0]?.nombre} · {e.parroquia ? `${e.parroquia}, ` : ""}
          {e.concello}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {e.categorias.slice(0, 3).map((c) => (
            <EtiquetaCategoria key={c} c={c} />
          ))}
        </div>
      </div>
    </Link>
  );
}
