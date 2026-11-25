import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Barras, Cifra, formato } from "@/components/Cifras";
import { exigirAdmin } from "@/lib/admin/sesion";
import { CATEGORIAS } from "@/lib/categorias";
import { concellos, organizadores, todosLosEventos } from "@/lib/eventos";
import { fechaCorta, fechaHoraGalicia } from "@/lib/fechas";
import { almacenMetricas } from "@/lib/metricas/almacen";
import { comparativaDestacados, ctr, desdeHace, ranking, semanal, tokenInforme, totales, type Totales } from "@/lib/metricas/informes";
import { NOMBRE_TIPO, type Fila } from "@/lib/metricas/modelo";
import type { Categoria } from "@/lib/tipos";
import CopiarEnlace from "./CopiarEnlace";

export default function Estadisticas({ searchParams }: PageProps<"/admin/estadisticas">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Calculando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

const PERIODOS = [
  ["7", "7 días"],
  ["30", "30 días"],
  ["90", "90 días"],
  ["365", "1 año"],
] as const;

async function Contenido({ searchParams }: Pick<PageProps<"/admin/estadisticas">, "searchParams">) {
  await exigirAdmin();
  await connection();
  const { p } = await searchParams;
  const dias = PERIODOS.some(([k]) => k === p) ? Number(p) : 30;
  const hoy = fechaHoraGalicia().slice(0, 10);
  const metricas = almacenMetricas();
  if (!metricas)
    return (
      <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        Las estadísticas se guardan en la base de datos (Turso o Supabase), y no está configurada. Sin ella no se registra nada.
      </p>
    );
  let filas: Fila[] = [];
  let error: string | null = null;
  try {
    // Para la evolución semanal se leen al menos 12 semanas
    filas = await metricas.leer(desdeHace(hoy, Math.max(dias, 84)));
  } catch (err) {
    error = (err as Error).message;
  }
  const desde = desdeHace(hoy, dias);
  const periodo = filas.filter((f) => f.dia >= desde);
  const t = totales(periodo);

  const eventos = new Map((await todosLosEventos()).map((e) => [e.slug, e]));
  const nombresConcello = new Map((await concellos()).map((c) => [c.slug, c.nombre]));
  const orgs = await organizadores();
  const nombresOrg = new Map(orgs.map((o) => [o.slug, o.nombre]));
  const topEventos = ranking(periodo, "evento").slice(0, 15);
  const porConcello = ranking(periodo, "concello");
  const porCategoria = ranking(periodo, "categoria");
  const porOrganizador = ranking(periodo, "organizador");
  const semanas = semanal(filas, hoy, 12);
  const { destacado, normal } = comparativaDestacados(periodo);

  return (
    <>
      <Link href="/admin" className="text-sm text-[var(--gris)] hover:underline">
        ← Pendientes
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl">Estadísticas</h1>
        <div className="flex gap-1 text-sm">
          {PERIODOS.map(([k, nombre]) => (
            <Link
              key={k}
              href={`/admin/estadisticas?p=${k}`}
              className={`rounded-full border px-3 py-1 ${String(dias) === k ? "border-[var(--tinta)] bg-[var(--arena)] font-medium" : "border-[var(--linea)] bg-white"}`}
            >
              {nombre}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-[var(--gris)]">
        Del {fechaCorta(desde)} al {fechaCorta(hoy)}. Métricas propias, sin cookies: no cuentan los bots ni tus visitas con el panel abierto. Las visitas a
        toda la web (portada, concellos…) están en Vercel Analytics.
      </p>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">No se han podido leer las métricas: {error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra titulo={NOMBRE_TIPO.vista} valor={formato(t.vista)} />
        <Cifra titulo={NOMBRE_TIPO.impresion} valor={formato(t.impresion)} />
        <Cifra titulo={NOMBRE_TIPO.clic} valor={formato(t.clic)} nota={ctr(t) !== null ? `${ctr(t)} % de las apariciones` : undefined} />
        <Cifra titulo="Acciones" valor={formato(t["como-llegar"] + t.calendario + t.inscripcion + t.compartir)} nota="cómo llegar, calendario, inscripción y compartir" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra titulo={NOMBRE_TIPO["como-llegar"]} valor={formato(t["como-llegar"])} />
        <Cifra titulo={NOMBRE_TIPO.calendario} valor={formato(t.calendario)} />
        <Cifra titulo={NOMBRE_TIPO.inscripcion} valor={formato(t.inscripcion)} />
        <Cifra titulo={NOMBRE_TIPO.compartir} valor={formato(t.compartir)} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl">Visitas a fichas por semana</h2>
        <div className="mt-3 rounded-2xl border border-[var(--linea)] bg-white p-4">
          <Barras etiqueta="Visitas a fichas por semana" datos={semanas.map((s) => ({ clave: fechaCorta(s.lunes), valor: s.t.vista }))} />
        </div>
      </section>

      <Tabla
        titulo="Eventos más vistos"
        filas={topEventos.map((r) => ({ clave: r.clave, nombre: eventos.get(r.clave)?.titulo ?? `${r.clave} (ya no publicado)`, enlace: eventos.has(r.clave) ? `/evento/${r.clave}` : undefined, t: r.t }))}
      />
      <Tabla titulo="Por concello" filas={porConcello.map((r) => ({ clave: r.clave, nombre: nombresConcello.get(r.clave) ?? r.clave, t: r.t }))} />
      <Tabla titulo="Por categoría" filas={porCategoria.map((r) => ({ clave: r.clave, nombre: CATEGORIAS[r.clave as Categoria]?.nombre ?? r.clave, t: r.t }))} />

      <section className="mt-8">
        <h2 className="font-display text-xl">Destacados frente a normales</h2>
        <p className="mt-1 text-sm text-[var(--gris)]">Para vender destacados: cuánto más se ven y se pulsan. El porcentaje de clics sale a partir de 50 apariciones.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--linea)] bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--gris)]">
              <tr>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 text-right font-medium">Apariciones</th>
                <th className="px-3 py-2 text-right font-medium">Clics</th>
                <th className="px-3 py-2 text-right font-medium">% clics</th>
                <th className="px-3 py-2 text-right font-medium">Visitas</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Destacados", destacado],
                  ["Normales", normal],
                ] as [string, Totales][]
              ).map(([n, x]) => (
                <tr key={n} className="border-t border-[var(--linea)]">
                  <td className="px-3 py-2">{n}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.impresion)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.clic)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ctr(x) ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.vista)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Informes para organizadores</h2>
        <p className="mt-1 text-sm text-[var(--gris)]">
          Cada organizador tiene un enlace secreto con las cifras de sus eventos (sin contraseña, no aparece en buscadores). Cópialo y envíaselo.
        </p>
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          {orgs
            .map((o) => ({ ...o, t: porOrganizador.find((r) => r.clave === o.slug)?.t }))
            .sort((a, b) => (b.t?.vista ?? 0) - (a.t?.vista ?? 0) || a.nombre.localeCompare(b.nombre))
            .map((o) => (
              <li key={o.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--linea)] bg-white p-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{nombresOrg.get(o.slug)}</span>
                  <span className="text-xs text-[var(--gris)]">
                    {o.total} {o.total === 1 ? "evento" : "eventos"} · {formato(o.t?.vista ?? 0)} visitas en el periodo
                  </span>
                </span>
                <span className="flex gap-2">
                  <Link href={`/informe/${o.slug}/${tokenInforme(o.slug)}`} target="_blank" className="rounded-full border border-[var(--linea)] px-3 py-1 hover:border-[var(--tinta)]">
                    Ver
                  </Link>
                  <CopiarEnlace ruta={`/informe/${o.slug}/${tokenInforme(o.slug)}`} />
                </span>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function Tabla({ titulo, filas }: { titulo: string; filas: { clave: string; nombre: string; enlace?: string; t: Totales }[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">{titulo}</h2>
      {!filas.length ? (
        <p className="mt-2 text-sm text-[var(--gris)]">Sin datos todavía en este periodo.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--linea)] bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--gris)]">
              <tr>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 text-right font-medium">Visitas</th>
                <th className="px-3 py-2 text-right font-medium">Apariciones</th>
                <th className="px-3 py-2 text-right font-medium" title="Cómo llegar">🧭</th>
                <th className="px-3 py-2 text-right font-medium" title="Calendario">📅</th>
                <th className="px-3 py-2 text-right font-medium" title="Inscripción">✍️</th>
                <th className="px-3 py-2 text-right font-medium" title="Compartir">↗</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} className="border-t border-[var(--linea)]">
                  <td className="max-w-[16rem] truncate px-3 py-2">
                    {f.enlace ? (
                      <Link href={f.enlace} target="_blank" className="hover:underline">
                        {f.nombre}
                      </Link>
                    ) : (
                      f.nombre
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formato(f.t.vista)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(f.t.impresion)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(f.t["como-llegar"])}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(f.t.calendario)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(f.t.inscripcion)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(f.t.compartir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
