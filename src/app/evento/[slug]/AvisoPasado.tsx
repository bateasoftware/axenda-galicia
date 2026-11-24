"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { hoyGalicia } from "@/lib/fechas";

const sinSuscripcion = () => () => {};

/** Aviso si el evento ya terminó. Depende de "hoy", así que solo se pinta en el navegador. */
export default function AvisoPasado({
  ultimoDia,
  recurrente,
  concello,
  concelloSlug,
}: {
  ultimoDia: string;
  recurrente?: boolean;
  concello: string;
  concelloSlug: string;
}) {
  const hoy = useSyncExternalStore(sinSuscripcion, hoyGalicia, () => null);
  if (!hoy || ultimoDia >= hoy) return null;
  return (
    <div className="mt-4 rounded-2xl border border-[var(--linea)] bg-[var(--arena)] p-4 text-sm">
      <p className="font-medium">Este evento ya se celebró.</p>
      <p className="mt-1 text-[var(--gris)]">
        {recurrente
          ? "Se repite cada año: publicaremos la próxima edición en cuanto haya fecha. "
          : ""}
        <Link href={`/concello/${concelloSlug}`} className="font-medium text-[var(--mar)] underline">
          Ver los próximos planes en {concello}
        </Link>
      </p>
    </div>
  );
}
