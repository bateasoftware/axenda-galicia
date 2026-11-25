import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Cifra, formato } from "@/components/Cifras";
import { capitalizar, fechaLarga, fechaHoraGalicia, primerInicio } from "@/lib/fechas";
import { fraseInforme, tokenValido } from "@/lib/metricas/informes";
import { informeOrganizador } from "@/lib/metricas/organizador";
import { SITIO } from "@/lib/sitio";
import Acciones from "./Acciones";

// Informe privado de un organizador: se llega con un enlace secreto (firma del organizador), sin contraseña.
export const metadata: Metadata = { title: "Informe de tus eventos", robots: { index: false, follow: false } };

export default function Informe({ params }: PageProps<"/informe/[organizador]/[token]">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Preparando el informe…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/informe/[organizador]/[token]">, "params">) {
  await connection();
  const { organizador, token } = await params;
  if (!tokenValido(organizador, token)) notFound();
  const inf = await informeOrganizador(organizador);
  if (!inf) notFound();
  const t = inf.total;
  const hoy = fechaHoraGalicia().slice(0, 10);
  const frases = inf.eventos.filter((x) => x.t.vista || x.t.impresion).map((x) => fraseInforme(x.evento.titulo, x.t));

  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-sm text-[var(--gris)]">Informe de {SITIO.nombre} · {capitalizar(fechaLarga(hoy))}</p>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl">{inf.nombre}</h1>
      <p className="mt-2 text-[var(--gris)]">
        Así les ha ido a tus eventos en la agenda {SITIO.nombre}, desde que se publicaron. Contamos visitas reales a la ficha, sin buscadores ni robots.
      </p>

      {!inf.conDatos && <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">Las estadísticas aún no están activadas.</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cifra titulo="Eventos publicados" valor={formato(inf.eventos.length)} />
        <Cifra titulo="Visitas a las fichas" valor={formato(t.vista)} />
        <Cifra titulo="Apariciones en la agenda" valor={formato(t.impresion)} />
        <Cifra titulo="Pidieron cómo llegar" valor={formato(t["como-llegar"])} />
        <Cifra titulo="Lo añadieron al calendario" valor={formato(t.calendario)} />
        <Cifra titulo="Lo compartieron" valor={formato(t.compartir)} />
      </div>

      {frases.length > 0 && (
        <section className="mt-8 rounded-2xl bg-[var(--arena)] p-4">
          <h2 className="font-display text-xl">En resumen</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[15px]">
            {frases.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl">Evento a evento</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--linea)] bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--gris)]">
              <tr>
                <th className="px-3 py-2 font-medium">Evento</th>
                <th className="px-3 py-2 text-right font-medium">Visitas</th>
                <th className="px-3 py-2 text-right font-medium">Apariciones</th>
                <th className="px-3 py-2 text-right font-medium">Cómo llegar</th>
                <th className="px-3 py-2 text-right font-medium">Calendario</th>
                <th className="px-3 py-2 text-right font-medium">Inscripción</th>
                <th className="px-3 py-2 text-right font-medium">Compartido</th>
              </tr>
            </thead>
            <tbody>
              {inf.eventos.map(({ evento: e, t: x }) => (
                <tr key={e.slug} className="border-t border-[var(--linea)]">
                  <td className="px-3 py-2">
                    <Link href={`/evento/${e.slug}`} className="hover:underline">
                      {e.titulo}
                    </Link>
                    <span className="block text-xs text-[var(--gris)]">{capitalizar(fechaLarga(primerInicio(e)))}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formato(x.vista)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.impresion)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x["como-llegar"])}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.calendario)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.inscripcion)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formato(x.compartir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Acciones csv={`/informe/${organizador}/${token}/csv`} titulo={`Informe de ${inf.nombre} en ${SITIO.nombre}`} />

      <p className="mt-8 text-sm text-[var(--gris)]">
        ¿Quieres que tus eventos lleguen a más gente? Mándanos tus carteles en{" "}
        <Link href="/enviar" className="underline">
          {SITIO.url.replace(/^https?:\/\//, "")}/enviar
        </Link>{" "}
        o mira cómo <Link href="/anunciate" className="underline">destacarlos</Link>.
      </p>
    </article>
  );
}
