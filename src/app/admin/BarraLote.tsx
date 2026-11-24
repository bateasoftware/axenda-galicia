"use client";

import { useEffect, useState } from "react";

/** Barra fija para elegir pendientes de la lista y descartarlos de una vez. Va dentro del <form id="lote">. */
export default function BarraLote({ visibles }: { visibles: number }) {
  const [marcados, setMarcados] = useState(0);

  useEffect(() => {
    const form = document.getElementById("lote") as HTMLFormElement | null;
    if (!form) return;
    const contar = () => setMarcados(form.querySelectorAll<HTMLInputElement>("input[name=ids]:checked").length);
    form.addEventListener("change", contar);
    return () => form.removeEventListener("change", contar);
  }, []);

  function marcar(valor: boolean) {
    const form = document.getElementById("lote") as HTMLFormElement;
    form.querySelectorAll<HTMLInputElement>("input[name=ids]").forEach((c) => (c.checked = valor));
    setMarcados(valor ? form.querySelectorAll("input[name=ids]").length : 0);
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--linea)] bg-[var(--fondo)]/95 p-3 backdrop-blur">
      <button type="button" onClick={() => marcar(true)} className="rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-sm hover:border-[var(--tinta)]">
        Seleccionar los {visibles}
      </button>
      {marcados > 0 && (
        <button type="button" onClick={() => marcar(false)} className="rounded-full px-3 py-1.5 text-sm text-[var(--gris)] hover:underline">
          Quitar selección
        </button>
      )}
      <button
        disabled={marcados === 0}
        onClick={(e) => {
          if (!confirm(`¿Descartar ${marcados} ${marcados === 1 ? "pendiente" : "pendientes"}? No vuelven a entrar al importar.`)) e.preventDefault();
        }}
        className="ml-auto rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 enabled:hover:bg-red-50 disabled:opacity-40"
      >
        Descartar{marcados > 0 ? ` (${marcados})` : ""}
      </button>
    </div>
  );
}
