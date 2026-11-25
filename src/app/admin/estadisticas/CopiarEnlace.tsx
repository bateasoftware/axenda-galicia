"use client";

import { useState } from "react";

/** Copia la dirección completa del informe (con el dominio actual) */
export default function CopiarEnlace({ ruta }: { ruta: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${location.origin}${ruta}`);
        setHecho(true);
        setTimeout(() => setHecho(false), 2000);
      }}
      className="rounded-full bg-[var(--tinta)] px-3 py-1 text-white"
    >
      {hecho ? "✓ Copiado" : "Copiar enlace"}
    </button>
  );
}
