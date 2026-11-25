"use client";

import { useState } from "react";

/** Guardar en PDF (imprimir), compartir el enlace o descargar los datos */
export default function Acciones({ csv, titulo }: { csv: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const boton = "rounded-full border border-[var(--linea)] bg-white px-4 py-2 text-sm font-medium hover:border-[var(--tinta)]";
  return (
    <div className="mt-8 flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => print()} className="rounded-full bg-[var(--tinta)] px-4 py-2 text-sm font-medium text-white">
        Guardar en PDF / imprimir
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            if (navigator.share) return await navigator.share({ title: titulo, url: location.href });
            await navigator.clipboard.writeText(location.href);
            setCopiado(true);
          } catch {
            // cancelado
          }
        }}
        className={boton}
      >
        {copiado ? "✓ Enlace copiado" : "Compartir enlace"}
      </button>
      <a href={csv} className={boton}>
        Descargar datos (CSV)
      </a>
    </div>
  );
}
