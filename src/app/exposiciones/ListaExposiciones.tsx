"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { TarjetaEvento } from "@/components/TarjetaEvento";
import { dia, fechaCorta, hoyGalicia, primerInicio, ultimoFin } from "@/lib/fechas";
import { DIAS_ULTIMOS, diasEntre, repartirLargas } from "@/lib/larga-duracion";
import { slugConcello } from "@/lib/slug";
import type { Evento } from "@/lib/tipos";

const sinSuscripcion = () => () => {};

/** Abiertas hoy y próximas, con filtro por concello (?concello=). «Hoy» solo existe en el navegador. */
export default function ListaExposiciones({ eventos }: { eventos: Evento[] }) {
  const hoy = useSyncExternalStore(sinSuscripcion, hoyGalicia, () => null);
  const params = useSearchParams();
  const concellos = [...new Set(eventos.map((e) => e.concello))].sort();
  const concello = concellos.find((c) => slugConcello(c) === params.get("concello")) ?? "";
  if (!hoy) return <div className="h-40 animate-pulse rounded-2xl bg-[var(--arena)]" />;

  const { abiertas, proximas } = repartirLargas(
    eventos.filter((e) => !concello || e.concello === concello),
    hoy,
  );
  const chip = (activo: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${activo ? "border-[var(--tinta)] bg-[var(--tinta)] text-white" : "border-[var(--linea)] bg-white hover:border-[var(--tinta)]"}`;
  const etiquetaAbierta = (e: Evento) => {
    const fin = dia(ultimoFin(e));
    if (fin === hoy) return "Último día";
    return diasEntre(hoy, fin) <= DIAS_ULTIMOS ? `Últimos días · hasta el ${fechaCorta(fin)}` : `Hasta el ${fechaCorta(fin)}`;
  };

  return (
    <>
      {concellos.length > 1 && (
        <div className="sin-barra -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Concello">
          <Link href="/exposiciones" scroll={false} className={chip(!concello)}>
            Todos los concellos
          </Link>
          {concellos.map((c) => (
            <Link key={c} href={`/exposiciones?concello=${slugConcello(c)}`} scroll={false} className={chip(c === concello)}>
              {c}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-display text-2xl">Abiertas ahora ({abiertas.length})</h2>
      {abiertas.length ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          {abiertas.map((e) => (
            <TarjetaEvento key={e.slug} e={e} hoy={hoy} etiqueta={etiquetaAbierta(e)} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--linea)] p-6 text-[var(--gris)]">Ahora mismo no hay ninguna abierta{concello ? ` en ${concello}` : ""}.</p>
      )}

      {proximas.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 font-display text-2xl">Abren pronto ({proximas.length})</h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {proximas.map((e) => (
              <TarjetaEvento key={e.slug} e={e} hoy={hoy} etiqueta={`Inaugura el ${fechaCorta(primerInicio(e))}`} />
            ))}
          </div>
        </>
      )}

      <p className="mt-10 text-sm text-[var(--gris)]">
        ¿Organizas una exposición?{" "}
        <Link href="/enviar" className="font-medium text-[var(--mar)] underline">
          Mándanos el cartel
        </Link>{" "}
        y la añadimos.
      </p>
    </>
  );
}
