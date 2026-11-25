// Piezas de presentación de cifras (panel, informes y media kit)
import type { ReactNode } from "react";

export const formato = (n: number) => n.toLocaleString("es-ES");

export function Cifra({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--linea)] bg-white p-4">
      <p className="text-xs text-[var(--gris)]">{titulo}</p>
      <p className="mt-1 font-display text-2xl">{valor}</p>
      {nota && <p className="text-[11px] text-[var(--gris)]">{nota}</p>}
    </div>
  );
}

/** Barras verticales simples (una serie), con la cifra encima y la etiqueta debajo */
export function Barras({ datos, etiqueta }: { datos: { clave: string; valor: number }[]; etiqueta: string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <div role="img" aria-label={etiqueta}>
      <div className="flex h-36 items-end gap-1.5">
        {datos.map((d) => (
          <div key={d.clave} className="flex h-full flex-1 flex-col justify-end" title={`${d.clave}: ${formato(d.valor)}`}>
            <span className="mb-0.5 text-center text-[10px] text-[var(--gris)] tabular-nums">{d.valor ? formato(d.valor) : ""}</span>
            <div className="rounded-t bg-[var(--mar)]" style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[10px] text-[var(--gris)]">
        {datos.map((d, i) => (
          <span key={d.clave} className="flex-1 truncate text-center">
            {i % 2 === 0 ? d.clave : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
