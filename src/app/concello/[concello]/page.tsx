import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { concellos, todosLosEventos } from "@/lib/eventos";
import Explorador from "@/components/Explorador";

export async function generateStaticParams() {
  return (await concellos()).map((c) => ({ concello: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/concello/[concello]">): Promise<Metadata> {
  const { concello } = await params;
  const c = (await concellos()).find((x) => x.slug === concello);
  if (!c) return {};
  return {
    title: `Qué hacer en ${c.nombre}: agenda de eventos`,
    description: `Fiestas, cine, deporte, mercadillos y actividades infantiles en ${c.nombre}. Agenda actualizada con mapa y calendario.`,
    alternates: { canonical: `/concello/${c.slug}` },
  };
}

export default async function PaginaConcello({ params }: PageProps<"/concello/[concello]">) {
  const { concello } = await params;
  const c = (await concellos()).find((x) => x.slug === concello);
  if (!c) notFound();
  const eventos = (await todosLosEventos()).filter((e) => e.concello === c.nombre);
  return (
    <>
      <Link href="/concellos" className="text-sm text-[var(--gris)] hover:underline">← Concellos</Link>
      <h1 className="mt-2 mb-6 font-display text-3xl sm:text-4xl">Qué hacer en {c.nombre}</h1>
      <Explorador eventos={eventos} concelloFijo={c.nombre} />
    </>
  );
}
