import { todosLosEventos } from "@/lib/eventos";
import { SITIO } from "@/lib/sitio";
import Explorador from "@/components/Explorador";

export default async function Inicio() {
  const eventos = await todosLosEventos();
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{SITIO.lema}</h1>
        <p className="mt-2 max-w-2xl text-[var(--gris)]">
          Fiestas, cine, deporte, mercadillos y planes con niños en Baiona, Nigrán, Gondomar y Vigo. Todo en un sitio, en
          mapa y calendario.
        </p>
      </div>
      <Explorador eventos={eventos} />
    </>
  );
}
