import type { Metadata } from "next";
import Link from "next/link";
import { Cifra, formato } from "@/components/Cifras";
import { fechaCorta } from "@/lib/fechas";
import { cifrasMediaKit, DIAS_MEDIAKIT } from "@/lib/metricas/mediakit";
import { SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Anúnciate: destaca tu evento o tu negocio",
  description: `Destacados y patrocinios en ${SITIO.nombre}, la agenda de Val Miñor y Vigo. Cifras reales de visitas y cómo se mide.`,
  alternates: { canonical: "/anunciate" },
};

const POCO = 100; // por debajo, las cifras de visitas aún no dicen mucho

export default async function Anunciate() {
  const c = await cifrasMediaKit();
  const asunto = encodeURIComponent(`Publicidad en ${SITIO.nombre}`);
  const empezando = c.vistas < POCO;

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-medium text-[var(--mar)]">Para comercios, hostelería y organizadores</p>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl">Llega a quien busca qué hacer en Val Miñor y Vigo</h1>
      <p className="mt-3 text-lg text-[var(--gris)]">
        {SITIO.nombre} es la agenda de la comarca: familias, vecinos y visitantes que miran qué hay este finde, en la lista, el mapa o el calendario. Publicar
        un evento es gratis; destacarlo te pone delante.
      </p>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Cifras reales</h2>
        <p className="mt-1 text-sm text-[var(--gris)]">
          Últimos {DIAS_MEDIAKIT} días (del {fechaCorta(c.desde)} al {fechaCorta(c.hoy)}). Las medimos nosotros, sin cookies: solo personas, sin buscadores ni
          robots. Se actualizan cada hora.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cifra titulo="Eventos en la agenda" valor={formato(c.eventos)} />
          <Cifra titulo="Organizadores" valor={formato(c.organizadores)} />
          <Cifra titulo="Concellos" valor={formato(c.concellos.length)} nota={c.concellos.join(", ")} />
          {!empezando && (
            <>
              <Cifra titulo="Visitas a fichas de eventos" valor={formato(c.vistas)} />
              <Cifra titulo="Apariciones de eventos en la agenda" valor={formato(c.apariciones)} />
              <Cifra titulo="Acciones" valor={formato(c.acciones)} nota="cómo llegar, calendario, inscripción y compartir" />
            </>
          )}
        </div>
        {empezando && (
          <p className="mt-3 rounded-xl bg-[var(--arena)] p-3 text-sm">
            Estamos empezando: aún no publicamos las cifras de visitas porque son pocas para que signifiquen algo. Si te interesa estar desde el principio,
            escríbenos: las condiciones de lanzamiento son las mejores.
          </p>
        )}
        {c.categorias.length > 0 && !empezando && <p className="mt-3 text-sm">Lo que más se mira: {c.categorias.join(", ")}.</p>}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Qué ofrecemos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Oferta titulo="⭐ Evento destacado" texto="Tu evento sale marcado como «Destacado» en la agenda y en el calendario, más visible que el resto, durante las fechas que elijas." />
          <Oferta titulo="📊 Informe de resultados" texto="Un informe con las visitas, apariciones y cuánta gente pidió cómo llegar o lo añadió a su calendario. Para saber qué te ha dado." />
          <Oferta titulo="🏘️ Patrocinio de un concello" texto="Tu marca en la página de un concello («Qué hacer en Nigrán…») durante un mes, junto a todos sus eventos." />
          <Oferta titulo="🧩 La agenda en tu web" texto="Hoteles, campings y casas rurales: pon los eventos de la zona en tu web con nuestro widget, siempre al día.">
            <Link href="/widget" className="mt-2 inline-block text-sm text-[var(--mar)] underline">
              Ver el widget
            </Link>
          </Oferta>
        </div>
        {c.mejoraDestacado !== null && c.mejoraDestacado > 1 && (
          <p className="mt-4 rounded-xl bg-[var(--arena)] p-3 text-sm">
            En los últimos {DIAS_MEDIAKIT} días, los eventos destacados se pulsaron <strong>{String(c.mejoraDestacado).replace(".", ",")} veces más</strong> que los
            normales cuando aparecían en la agenda.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Cómo medimos</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[15px] text-[var(--gris)]">
          <li>Contamos visitas a la ficha, apariciones en la agenda y acciones (cómo llegar, calendario, inscripción, compartir), por evento y por día.</li>
          <li>Sin cookies ni datos personales: no guardamos IP ni identificadores. No contamos buscadores, robots ni previsualizaciones de enlaces.</li>
          <li>Los destacados se miden aparte, para comparar con los eventos normales.</li>
        </ul>
      </section>

      <div className="mt-10 rounded-2xl bg-[var(--tinta)] p-6 text-white">
        <p className="font-display text-2xl">¿Hablamos?</p>
        <p className="mt-1 text-white/80">Cuéntanos qué quieres anunciar y te proponemos algo a medida.</p>
        <a href={`mailto:${SITIO.emailEnvio}?subject=${asunto}`} className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-medium text-[var(--tinta)]">
          ✉️ {SITIO.emailEnvio}
        </a>
      </div>
    </div>
  );
}

function Oferta({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--linea)] bg-white p-4">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 text-sm text-[var(--gris)]">{texto}</p>
      {children}
    </div>
  );
}
