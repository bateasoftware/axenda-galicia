import type { Metadata } from "next";
import { Suspense } from "react";
import { todosLosEventos } from "@/lib/eventos";
import { esLargaDuracion } from "@/lib/larga-duracion";
import ListaExposiciones from "./ListaExposiciones";

export const metadata: Metadata = {
  title: "Exposiciones y muestras en Val Miñor y Vigo",
  description: "Exposiciones de pintura, fotografía y muestras abiertas ahora en Baiona, Nigrán, Gondomar y Vigo, y las que abren pronto. Con horarios y mapa.",
  alternates: { canonical: "/exposiciones" },
};

export default async function Exposiciones() {
  const eventos = (await todosLosEventos()).filter(esLargaDuracion);
  return (
    <>
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">Exposiciones y muestras</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[var(--gris)]">
        Lo que está abierto durante semanas o meses en Val Miñor y Vigo: exposiciones, muestras y ferias largas. Para ir cuando te venga bien; las que cierran
        antes, primero.
      </p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[var(--arena)]" />}>
        <ListaExposiciones eventos={eventos} />
      </Suspense>
    </>
  );
}
