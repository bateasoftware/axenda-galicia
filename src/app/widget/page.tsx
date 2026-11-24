import type { Metadata } from "next";
import { concellos } from "@/lib/eventos";
import { SITIO } from "@/lib/sitio";
import Generador from "./Generador";

export const metadata: Metadata = {
  title: "Widget: pon la agenda en tu web",
  description: "Inserta gratis la agenda de eventos de tu concello en la web de tu hotel, camping, asociación o concello.",
  alternates: { canonical: "/widget" },
};

export default async function Widget() {
  const lista = (await concellos()).map(({ nombre, slug }) => ({ nombre, slug }));
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl sm:text-4xl">Pon la agenda de la zona en tu web</h1>
      <p className="mt-3 text-lg text-[var(--gris)]">
        Para hoteles, campings, casas rurales, asociaciones y concellos: los próximos eventos de tu concello, siempre al día y sin mantenimiento.
        Gratis.
      </p>
      <ol className="mt-6 list-inside list-decimal space-y-1 text-[15px]">
        <li>Elige el concello, cuántos eventos y el estilo.</li>
        <li>Copia el código y pégalo en tu web donde quieras que salga (en WordPress, en un bloque «HTML personalizado»).</li>
        <li>Listo: se actualiza solo cada vez que publicamos algo.</li>
      </ol>
      <Generador concellos={lista} origen={SITIO.url} />
      <section className="mt-10 text-sm text-[var(--gris)]">
        <h2 className="font-display text-xl text-[var(--tinta)]">Preguntas</h2>
        <p className="mt-2">
          <b>¿Ralentiza mi web?</b> No: se carga aparte (iframe) y solo cuando el visitante llega a esa parte de la página.
        </p>
        <p className="mt-2">
          <b>¿Sin JavaScript?</b> Puedes usar directamente el iframe: <code className="break-all">{`<iframe src="${SITIO.url}/widget/agenda?concello=nigran" width="100%" height="480" style="border:0"></iframe>`}</code>
        </p>
        <p className="mt-2">
          <b>¿Falta algún evento?</b> Mándanoslo en <a href="/enviar" className="underline">/enviar</a> y aparecerá también en tu web.
        </p>
      </section>
    </div>
  );
}
