import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Explorador from "@/components/Explorador";
import { organizadores, slugConcello, todosLosEventos } from "@/lib/eventos";
import { SITIO } from "@/lib/sitio";

export async function generateStaticParams() {
  return (await organizadores()).map((o) => ({ slug: o.slug }));
}

async function buscar(slug: string) {
  return (await organizadores()).find((o) => o.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/organizador/[slug]">): Promise<Metadata> {
  const o = await buscar((await params).slug);
  if (!o) return {};
  return {
    title: `${o.nombre}: agenda de eventos`,
    description: `Todos los eventos de ${o.nombre} en ${SITIO.nombre}: fechas, lugares y mapa.`,
    alternates: { canonical: `/organizador/${o.slug}` },
  };
}

export default async function PaginaOrganizador({ params }: PageProps<"/organizador/[slug]">) {
  const { slug } = await params;
  const o = await buscar(slug);
  if (!o) notFound();
  const eventos = (await todosLosEventos()).filter((e) => e.organizadores.some((x) => slugConcello(x) === slug));
  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: o.nombre, url: `${SITIO.url}/organizador/${o.slug}` };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="text-sm text-[var(--gris)]">Organizador</p>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl">{o.nombre}</h1>
      <p className="mt-2 mb-6 text-[var(--gris)]">
        {o.total} {o.total === 1 ? "evento" : "eventos"} en la agenda.{" "}
        <Link href="/enviar" className="text-[var(--mar)] underline">
          ¿Eres de {o.nombre}? Mándanos vuestros carteles
        </Link>{" "}
        y aparecerán aquí.
      </p>
      <Explorador eventos={eventos} />
      <section className="mt-10 rounded-2xl border border-[var(--linea)] bg-white p-5">
        <h2 className="font-display text-xl">Comparte o inserta esta agenda</h2>
        <p className="mt-1 text-sm text-[var(--gris)]">
          Enlace directo: <span className="break-all font-mono">{`${SITIO.url}/organizador/${o.slug}`}</span>. Para ponerla en vuestra web, mira el{" "}
          <Link href="/widget" className="underline">
            widget de la agenda
          </Link>
          .
        </p>
      </section>
    </>
  );
}
