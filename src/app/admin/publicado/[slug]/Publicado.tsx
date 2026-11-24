"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResultadoPublicacion } from "@/lib/admin/publicacion";

export default function Publicado({ estado }: { estado: ResultadoPublicacion }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(estado.mensaje);
    setCopiado(true);
  };
  const a = estado.aviso;
  return (
    <div className="space-y-4">
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-display text-xl">✓ Publicado</p>
        <p className="mt-1 text-sm">
          <a href={estado.url} target="_blank" className="break-all underline">
            {estado.url}
          </a>
        </p>
        <p className="mt-1 text-xs text-[var(--gris)]">La web se actualiza en unos segundos.</p>
        {estado.avisos.map((x) => (
          <p key={x} className="mt-1 text-xs text-amber-800">
            ⚠ {x}
          </p>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--linea)] bg-white p-4">
        <p className="text-sm font-medium">Mensaje para el organizador</p>
        {a.tipo === "whatsapp-enviado" && <p className="mt-1 text-sm text-emerald-700">💬 Enviado por WhatsApp a quien lo mandó.</p>}
        {a.tipo === "whatsapp-error" && (
          <p className="mt-1 text-sm text-red-700">
            No se pudo enviar por WhatsApp. Mándalo a mano a +{a.numero} (este número no se guarda).
          </p>
        )}
        {a.tipo === "email" && (
          <p className="mt-1 text-sm">
            ✉️{" "}
            <a className="underline" href={`mailto:${a.email}?subject=${encodeURIComponent("Tu evento ya está en Axenda")}&body=${encodeURIComponent(estado.mensaje)}`}>
              Responder a quien lo envió
            </a>{" "}
            (el email no se guarda).
          </p>
        )}
        <pre className="mt-3 rounded-xl bg-[var(--arena)] p-3 text-sm whitespace-pre-wrap">{estado.mensaje}</pre>
        <button onClick={copiar} className="mt-3 rounded-full bg-[var(--tinta)] px-4 py-2 text-sm font-medium text-white">
          {copiado ? "Copiado ✓" : "Copiar mensaje"}
        </button>
      </div>
      <Link href="/admin" className="inline-block rounded-full border border-[var(--linea)] bg-white px-4 py-2 text-sm font-medium">
        ← Siguiente pendiente
      </Link>
    </div>
  );
}
