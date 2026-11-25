import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventoPorSlug, slugConcello, todosLosEventos } from "@/lib/eventos";
import { capitalizar, fechaSchema, fechaLarga, hora, primerInicio, ultimoFin, dia } from "@/lib/fechas";
import { SITIO } from "@/lib/sitio";
import CartelGenerico from "@/components/CartelGenerico";
import { EtiquetaCategoria } from "@/components/TarjetaEvento";
import MapaEvento from "./MapaEvento";
import AvisoPasado from "./AvisoPasado";
import { BotonCompartir, EnlaceMedido, VistaEvento } from "./Medicion";
import type { Evento } from "@/lib/tipos";

export async function generateStaticParams() {
  return (await todosLosEventos()).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/evento/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await eventoPorSlug(slug);
  if (!e) return {};
  const cuando = fechaLarga(primerInicio(e));
  return {
    title: `${e.titulo} – ${cuando}, ${e.concello}`,
    description: `${e.resumen} ${e.lugares[0]?.nombre}, ${e.concello}.`,
    alternates: { canonical: `/evento/${e.slug}` },
    // Sin cartel se hereda la imagen OG general (src/app/opengraph-image.tsx)
    openGraph: { title: e.titulo, description: e.resumen, ...(e.cartel ? { images: [e.cartel] } : {}) },
  };
}

/**
 * Precio para schema.org. Solo se declara si el cartel lo dice: "gratis" o una cifra en euros.
 * Google marca un aviso si falta, pero es peor inventarlo.
 */
function oferta(e: Evento, url: string) {
  if (!e.precio) return {};
  const destino = e.inscripcion?.url ?? url;
  if (/gratu|gratis|libre|de balde|sin coste/i.test(e.precio))
    return {
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "EUR", availability: "https://schema.org/InStock", url: destino },
    };
  const cifra = e.precio.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i);
  if (cifra)
    return {
      offers: { "@type": "Offer", price: Number(cifra[1].replace(",", ".")), priceCurrency: "EUR", availability: "https://schema.org/InStock", url: destino },
    };
  return {};
}

export default async function PaginaEvento({ params }: PageProps<"/evento/[slug]">) {
  const { slug } = await params;
  const e = await eventoPorSlug(slug);
  if (!e) notFound();

  const url = `${SITIO.url}/evento/${e.slug}`;
  const l0 = e.lugares[0];
  const ultima = e.sesiones[e.sesiones.length - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titulo,
    ...(e.titulo_gl && e.titulo_gl !== e.titulo ? { alternateName: e.titulo_gl } : {}),
    description: e.resumen,
    startDate: fechaSchema(e.sesiones[0].inicio),
    endDate: fechaSchema(ultima.fin ?? ultima.inicio),
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
    ...oferta(e, url),
    inLanguage: e.idioma === "gl" ? "gl" : "es",
    url,
  };

  return (
    <article className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
      {/* Se escapa "<": los textos vienen de carteles y un "</script>" cerraría la etiqueta */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div>
        <Link href="/" className="text-sm text-[var(--gris)] hover:underline">← Volver a la agenda</Link>
        <div className="mt-3 flex flex-wrap gap-1">
          {e.categorias.map((c) => <EtiquetaCategoria key={c} c={c} />)}
          {e.comercial && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Promoción de comercio</span>}
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{e.titulo}</h1>
        {e.titulo_gl && e.titulo_gl !== e.titulo && <p className="mt-1 italic text-[var(--gris)]">{e.titulo_gl}</p>}
        <AvisoPasado ultimoDia={dia(ultimoFin(e))} recurrente={e.recurrente} concello={e.concello} concelloSlug={slugConcello(e.concello)} />
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
          {e.organizadores.length > 0 && (
            <Fila t="Organiza">
              {e.organizadores.map((o, i) => (
                <span key={o}>
                  {i > 0 && ", "}
                  <Link href={`/organizador/${slugConcello(o)}`} className="underline decoration-[var(--linea)] underline-offset-2 hover:decoration-current">
                    {o}
                  </Link>
                </span>
              ))}
            </Fila>
          )}
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
              {e.inscripcion.url && (
                <EnlaceMedido slug={e.slug} tipo="inscripcion" href={e.inscripcion.url} target="_blank" rel="noopener nofollow" className="text-[var(--mar)] underline">
                  Formulario de inscripción
                </EnlaceMedido>
              )}
              {(e.inscripcion.telefono || e.inscripcion.email) && (
                <p className="text-sm text-[var(--gris)]">{[e.inscripcion.telefono, e.inscripcion.email].filter(Boolean).join(" · ")}</p>
              )}
            </Fila>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <EnlaceMedido slug={e.slug} tipo="calendario" href={`/evento/${e.slug}/calendario.ics`} className="rounded-full bg-[var(--tinta)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            📅 Añadir a mi calendario
          </EnlaceMedido>
          {l0 && (
            <EnlaceMedido
              slug={e.slug}
              tipo="como-llegar"
              href={`https://www.google.com/maps/dir/?api=1&destination=${l0.lat},${l0.lng}`}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-[var(--linea)] bg-white px-4 py-2 text-sm font-medium hover:border-[var(--tinta)]"
            >
              🧭 Cómo llegar
            </EnlaceMedido>
          )}
          <BotonCompartir slug={e.slug} titulo={e.titulo} url={url} />
        </div>
        <VistaEvento slug={e.slug} />

        <div className="mt-6">
          <MapaEvento evento={e} />
        </div>

        {(e.fuente.atribucion || e.fuente.url) && (
          <p className="mt-4 text-xs text-[var(--gris)]">
            {e.fuente.atribucion ?? "Fuente"}
            {e.fuente.url && (
              <>
                {" · "}
                <a href={e.fuente.url} target="_blank" rel="noopener nofollow" className="underline">
                  Ver en la fuente original
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <aside>
        {e.cartel ? (
          <a href={e.cartel} target="_blank" className="block overflow-hidden rounded-2xl border border-[var(--linea)] bg-white">
            <Image src={e.cartel} alt={`Cartel: ${e.titulo}`} width={680} height={900} className="h-auto w-full" priority />
          </a>
        ) : (
          <CartelGenerico categorias={e.categorias} className="aspect-[3/4] w-full rounded-2xl border border-[var(--linea)]" />
        )}
        <p className="mt-2 text-xs text-[var(--gris)]">
          {e.cartel ? "Cartel facilitado por la organización. " : "Ilustración genérica: este evento no tiene cartel. "}Comprueba los detalles antes de ir.
        </p>
      </aside>
    </article>
  );
}

function Fila({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 px-4 py-3 text-sm sm:grid-cols-[96px_minmax(0,1fr)] sm:text-base">
      <dt className="font-medium text-[var(--gris)]">{t}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
