import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { almacen, almacenDisponible, type RegistroCobertura } from "@/lib/almacen";
import { resumenCobertura } from "@/lib/admin/cobertura";
import { exigirAdmin } from "@/lib/admin/sesion";
import { todosLosEventos } from "@/lib/eventos";
import { fechaCorta, fechaHoraGalicia } from "@/lib/fechas";
import registroFuentes from "../../../../data/fuentes.json";

export default function Cobertura() {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Calculando…</p>}>
      <Contenido />
    </Suspense>
  );
}

const NOMBRE_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  formulario: "Formulario",
  email: "Email",
  ics: "Calendarios ICS",
  "programa-pdf": "Programas PDF",
  "datos-abiertos": "Datos abiertos",
  manual: "Manual",
};
const COLOR_CANAL: Record<string, string> = {
  whatsapp: "#1f8f4e",
  formulario: "#0b6e8a",
  email: "#6941c6",
  ics: "#b54708",
  "programa-pdf": "#c11574",
  "datos-abiertos": "#344054",
  manual: "#98a2b3",
};

async function Contenido() {
  await exigirAdmin();
  if (!almacenDisponible()) return <p className="mt-6">Falta configurar Supabase.</p>;
  const a = almacen();
  const registros: RegistroCobertura[] = await a.cobertura();
  // Con Supabase, lo publicado en data/eventos (git) también cuenta
  if (a.tipo === "supabase") {
    const enSupabase = new Set((await a.publicados()).map((e) => e.slug));
    for (const e of await todosLosEventos())
      if (!enSupabase.has(e.slug))
        registros.push({ estado: "publicado", canal: e.fuente.canal, id_fuente: e.fuente.id_fuente, concello: e.concello, inicio: e.sesiones[0]?.inicio, recibido: e.fuente.recibido });
  }
  await connection(); // la fecha de hoy, en cada petición
  const hoy = fechaHoraGalicia().slice(0, 10);
  const r = resumenCobertura(registros, hoy);
  const nombresFuente = new Map(registroFuentes.fuentes.map((f) => [f.id, f.nombre]));
  const maxSemana = Math.max(1, ...r.semanas.map((s) => s.total));

  return (
    <>
      <Link href="/admin" className="text-sm text-[var(--gris)] hover:underline">
        ← Pendientes
      </Link>
      <h1 className="mt-2 font-display text-3xl">Cobertura</h1>
      <p className="mt-1 text-sm text-[var(--gris)]">Qué canal funciona: eventos recibidos por canal, fuente, concello y semana (incluye pendientes y descartados).</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra titulo="Publicados" valor={r.publicados} />
        <Cifra titulo="Pendientes" valor={r.pendientes} />
        <Cifra titulo="Descartados" valor={r.descartados} />
        <Cifra titulo="Envío directo" valor={`${r.directo} %`} nota="de lo publicado" />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl">Por semana de llegada</h2>
        <div className="mt-3 flex h-40 items-end gap-1.5" role="img" aria-label="Eventos recibidos por semana y canal">
          {r.semanas.map((s) => (
            <div key={s.lunes} className="flex h-full flex-1 flex-col justify-end" title={`Semana del ${fechaCorta(s.lunes)}: ${s.total} recibidos, ${s.publicados} publicados`}>
              <div className="flex flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(s.total / maxSemana) * 100}%` }}>
                {Object.entries(s.porCanal).map(([c, n]) => (
                  <div key={c} style={{ flexGrow: n, background: COLOR_CANAL[c] ?? "#98a2b3" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 text-[10px] text-[var(--gris)]">
          {r.semanas.map((s, i) => (
            <span key={s.lunes} className="flex-1 text-center">
              {i % 2 === 0 ? fechaCorta(s.lunes) : ""}
            </span>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-3 text-xs">
          {r.porCanal.map((c) => (
            <li key={c.clave} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_CANAL[c.clave] ?? "#98a2b3" }} />
              {NOMBRE_CANAL[c.clave] ?? c.clave}
            </li>
          ))}
        </ul>
      </section>

      <Tabla titulo="Por canal" filas={r.porCanal} nombre={(k) => NOMBRE_CANAL[k] ?? k} />
      <Tabla titulo="Por fuente (importadores)" filas={r.porFuente} nombre={(k) => nombresFuente.get(k) ?? k} vacio="Aún no hay eventos importados de data/fuentes.json." />
      <Tabla titulo="Por concello" filas={r.porConcello} nombre={(k) => k} />
    </>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: number | string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--linea)] bg-white p-4">
      <p className="text-xs text-[var(--gris)]">{titulo}</p>
      <p className="mt-1 font-display text-2xl">{valor}</p>
      {nota && <p className="text-[11px] text-[var(--gris)]">{nota}</p>}
    </div>
  );
}

function Tabla({
  titulo,
  filas,
  nombre,
  vacio = "Sin datos todavía.",
}: {
  titulo: string;
  filas: { clave: string; publicado: number; pendiente: number; descartado: number; total: number }[];
  nombre: (k: string) => string;
  vacio?: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">{titulo}</h2>
      {filas.length ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--linea)] bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--gris)]">
              <tr>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 text-right font-medium">Publicados</th>
                <th className="px-3 py-2 text-right font-medium">Pendientes</th>
                <th className="px-3 py-2 text-right font-medium">Descartados</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} className="border-t border-[var(--linea)]">
                  <td className="px-3 py-2">{nombre(f.clave)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.publicado}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.pendiente}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.descartado}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{f.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--gris)]">{vacio}</p>
      )}
    </section>
  );
}
