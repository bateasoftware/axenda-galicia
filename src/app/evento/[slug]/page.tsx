import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventoPorSlug, slugConcello, todosLosEventos } from "@/lib/eventos";
import { capitalizar, fechaLarga, generarICS, hora, primerInicio, dia } from "@/lib/fechas";
import { SITIO } from "@/lib/sitio";
import { EtiquetaCategoria } from "@/components/TarjetaEvento";
import MapaEvento from "./MapaEvento";

export function generateStaticParams() {
  return todosLosEventos().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/evento/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = eventoPorSlug(slug);
  if (!e) return {};
  const cuando = fechaLarga(primerInicio(e));
  return {
    title: `${e.titulo} – ${cuando}, ${e.concello}`,
    description: `${e.resumen} ${e.lugares[0]?.nombre}, ${e.concello}.`,
    alternates: { canonical: `/evento/${e.slug}` },
    openGraph: { title: e.titulo, description: e.resumen, images: e.cartel ? [e.cartel] : [] },
  };
}

/** "2026-11-22T17:00" → "2026-11-22T17:00:00+01:00" (hora de Madrid) */
function conZona(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const h = Number(iso.slice(11, 13) || 12);
  const off = new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" })
    .formatToParts(new Date(Date.UTC(y, m - 1, d, h)))
    .find((p) => p.type === "timeZoneName")?.value; // "GMT+1"
  const n = Number(off?.replace("GMT", "") || 1);
  return `${iso.length > 10 ? iso : iso + "T00:00"}:00+0${n}:00`;
}

export default async function PaginaEvento({ params }: PageProps<"/evento/[slug]">) {
  const { slug } = await params;
  const e = eventoPorSlug(slug);
  if (!e) notFound();

  const url = `${SITIO.url}/evento/${e.slug}`;
  const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(generarICS(e, url))}`;
  const l0 = e.lugares[0];
  const ultima = e.sesiones[e.sesiones.length - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titulo,
    description: e.resumen,
    startDate: conZona(e.sesiones[0].inicio),
    endDate: conZona(ultima.fin ?? ultima.inicio),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: e.cartel ? [`${SITIO.url}${e.cartel}`] : undefined,
    location: e.lugares.map((l) => ({
      "@type": "Place",
      name: l.nombre,
      address: {
        "@type": "PostalAddress",
        streetAddress: l.direccion,
        addressLocality: e.parroquia ?? e.concello,
        addressRegion: "Pontevedra",
        addressCountry: "ES",
      },
      geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng },
    })),
    organizer: e.organizadores.map((o) => ({ "@type": "Organization", name: o })),
    url,
  };

  return (
    <article className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div>
        <Link href="/" className="text-sm text-[var(--gris)] hover:underline">← Volver a la agenda</Link>
        <div className="mt-3 flex flex-wrap gap-1">
          {e.categorias.map((c) => <EtiquetaCategoria key={c} c={c} />)}
          {e.comercial && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Promoción de comercio</span>}
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{e.titulo}</h1>
        {e.titulo_gl && e.titulo_gl !== e.titulo && <p className="mt-1 italic text-[var(--gris)]">{e.titulo_gl}</p>}
        <p className="mt-4 text-lg leading-relaxed">{e.resumen}</p>

        <dl className="mt-6 divide-y divide-[var(--linea)] rounded-2xl border border-[var(--linea)] bg-white">
          <Fila t="Cuándo">
            <ul className="space-y-1">
              {e.sesiones.map((s, i) => (
                <li key={i}>
                  <span>{capitalizar(fechaLarga(s.inicio))}</span>
                  {hora(s.inicio) && ` · ${hora(s.inicio)}`}
                  {s.fin && (dia(s.fin) === dia(s.inicio) ? `–${hora(s.fin)}` : ` – ${fechaLarga(s.fin)} ${hora(s.fin)}`)}
                  {s.nota && <span className="text-[var(--gris)]"> · {s.nota}</span>}
                </li>
              ))}
            </ul>
          </Fila>
          <Fila t="Dónde">
            <ul className="space-y-1">
              {e.lugares.map((l) => (
                <li key={l.nombre}>
                  {l.nombre}
                  {l.direccion && <span className="text-[var(--gris)]"> · {l.direccion}</span>}
                </li>
              ))}
            </ul>
            <Link href={`/concello/${slugConcello(e.concello)}`} className="text-sm text-[var(--mar)] underline">
              Más planes en {e.concello}
            </Link>
          </Fila>
          <Fila t="Organiza">{e.organizadores.join(", ")}</Fila>
          {e.publico && <Fila t="Para">{e.publico}</Fila>}
          {e.precio && <Fila t="Precio">{e.precio}</Fila>}
          {e.extras?.length ? (
            <Fila t="Además">
              <ul className="list-inside list-disc">{e.extras.map((x) => <li key={x}>{x}</li>)}</ul>
            </Fila>
          ) : null}
          {e.inscripcion && (
            <Fila t="Inscripción">
              {e.inscripcion.hasta && <p>Hasta el {fechaLarga(e.inscripcion.hasta)}</p>}
              {e.inscripcion.url && <a href={e.inscripcion.url} target="_blank" rel="noopener nofollow" className="text-[var(--mar)] underline">Formulario de inscripción</a>}
              {(e.inscripcion.telefono || e.inscripcion.email) && (
                <p className="text-sm text-[var(--gris)]">{[e.inscripcion.telefono, e.inscripcion.email].filter(Boolean).join(" · ")}</p>
              )}
            </Fila>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <a href={ics} download={`${e.slug}.ics`} className="rounded-full bg-[var(--tinta)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            📅 Añadir a mi calendario
          </a>
          {l0 && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${l0.lat},${l0.lng}`}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-[var(--linea)] bg-white px-4 py-2 text-sm font-medium hover:border-[var(--tinta)]"
            >
              🧭 Cómo llegar
            </a>
          )}
        </div>

        <div className="mt-6">
          <MapaEvento evento={e} />
        </div>
      </div>

      <aside>
        {e.cartel && (
          <a href={e.cartel} target="_blank" className="block overflow-hidden rounded-2xl border border-[var(--linea)] bg-white">
            <Image src={e.cartel} alt={`Cartel: ${e.titulo}`} width={680} height={900} className="h-auto w-full" priority />
          </a>
        )}
        <p className="mt-2 text-xs text-[var(--gris)]">Cartel facilitado por la organización. Comprueba los detalles antes de ir.</p>
      </aside>
    </article>
  );
}

function Fila({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 px-4 py-3 text-sm sm:text-base">
      <dt className="font-medium text-[var(--gris)]">{t}</dt>
      <dd>{children}</dd>
    </div>
  );
}
