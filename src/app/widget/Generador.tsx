"use client";

import { useState } from "react";

export default function Generador({ concellos, origen }: { concellos: { nombre: string; slug: string }[]; origen: string }) {
  const [concello, setConcello] = useState(concellos[0]?.slug ?? "");
  const [n, setN] = useState(6);
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");
  const [copiado, setCopiado] = useState(false);
  const atributos = `${concello ? ` data-concello="${concello}"` : ""} data-n="${n}" data-tema="${tema}"`;
  const codigo = `<div data-axenda-agenda${atributos}></div>\n<script src="${origen}/widget.js" async></script>`;
  // La vista previa usa este mismo servidor (sirve también en local y en las previsualizaciones)
  const q = new URLSearchParams({ n: String(n), tema, ...(concello ? { concello } : {}) });
  const campo = "rounded-xl border border-[var(--linea)] bg-white px-3 py-2";

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Concello</span>
          <select value={concello} onChange={(e) => setConcello(e.target.value)} className={`mt-1 block w-full ${campo}`}>
            <option value="">Todos</option>
            {concellos.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="text-sm font-medium">Eventos</span>
            <input type="number" min={1} max={20} value={n} onChange={(e) => setN(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className={`mt-1 block w-full ${campo}`} />
          </label>
          <label className="block flex-1">
            <span className="text-sm font-medium">Estilo</span>
            <select value={tema} onChange={(e) => setTema(e.target.value as "claro" | "oscuro")} className={`mt-1 block w-full ${campo}`}>
              <option value="claro">Claro</option>
              <option value="oscuro">Oscuro</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Código para pegar</span>
          <textarea readOnly value={codigo} rows={4} onFocus={(e) => e.target.select()} className={`mt-1 block w-full font-mono text-xs ${campo}`} />
        </label>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
          }}
          className="rounded-full bg-[var(--tinta)] px-4 py-2 text-sm font-medium text-white"
        >
          {copiado ? "Copiado ✓" : "Copiar código"}
        </button>
      </div>
      <div>
        <p className="text-sm font-medium">Vista previa</p>
        <iframe key={q.toString()} src={`/widget/agenda?${q}`} title="Vista previa del widget" className="mt-1 h-[460px] w-full rounded-xl border border-[var(--linea)]" />
      </div>
    </div>
  );
}
