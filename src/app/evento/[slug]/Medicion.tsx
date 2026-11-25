"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { medir } from "@/lib/metricas/cliente";
import type { TipoMetrica } from "@/lib/metricas/modelo";

/** Cuenta la visita a la ficha (una vez por página abierta) */
export function VistaEvento({ slug }: { slug: string }) {
  useEffect(() => medir("vista", slug), [slug]);
  return null;
}

/** Un enlace normal que además cuenta el clic (cómo llegar, calendario, inscripción…) */
export function EnlaceMedido({ slug, tipo, ...props }: ComponentProps<"a"> & { slug: string; tipo: TipoMetrica }) {
  return <a {...props} onClick={() => medir(tipo, slug)} />;
}

/** Compartir: el menú del sistema en el móvil; si no lo hay, copia el enlace */
export function BotonCompartir({ slug, titulo, url }: { slug: string; titulo: string; url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        medir("compartir", slug);
        try {
          if (navigator.share) await navigator.share({ title: titulo, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          }
        } catch {
          // compartir cancelado
        }
      }}
      className="rounded-full border border-[var(--linea)] bg-white px-4 py-2 text-sm font-medium hover:border-[var(--tinta)]"
    >
      {copiado ? "✓ Enlace copiado" : "↗ Compartir"}
    </button>
  );
}
