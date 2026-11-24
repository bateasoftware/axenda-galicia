import type { Metadata } from "next";
import { SITIO } from "@/lib/sitio";
import FormularioEnvio from "./FormularioEnvio";

export const metadata: Metadata = {
  title: "Enviar un evento",
  description: "Manda el cartel de tu evento y lo publicamos gratis en la agenda.",
};

export default function Enviar() {
  const asunto = encodeURIComponent("Nuevo evento para la agenda");
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO?.replace(/\D/g, "");
  const cuerpo = encodeURIComponent("Adjunto el cartel.\n\nQué: \nCuándo: \nDónde: \nOrganiza: \nWeb o contacto: \n");
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl sm:text-4xl">¿Organizas algo? Publícalo gratis</h1>
      <p className="mt-3 text-lg text-[var(--gris)]">
        Mándanos el cartel tal cual lo compartes por WhatsApp o redes. Nosotros sacamos la fecha, el lugar y el resto, y lo
        ponemos en el mapa y en el calendario.
      </p>
      <ol className="mt-8 space-y-4">
        {[
          ["Envía el cartel", "Una imagen y, si quieres, dos líneas con lo que no aparezca en él."],
          ["Lo revisamos", "Comprobamos fecha, hora y lugar. Suele estar publicado el mismo día."],
          ["Aparece en la agenda", "En la lista, el mapa, el calendario y la página de tu concello."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-4 rounded-2xl border border-[var(--linea)] bg-white p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--tinta)] font-semibold text-white">{i + 1}</span>
            <div>
              <p className="font-medium">{t}</p>
              <p className="text-sm text-[var(--gris)]">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="mt-10 font-display text-2xl">Envíalo aquí</h2>
      <div className="mt-3">
        <FormularioEnvio turnstile={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined} />
      </div>
      <h2 className="mt-10 font-display text-2xl">O por donde te venga mejor</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {whatsapp ? (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, os mando el cartel de un evento:")}`}
            className="rounded-full bg-[#1f8f4e] px-5 py-2.5 font-medium text-white hover:opacity-90"
          >
            💬 WhatsApp: +{whatsapp}
          </a>
        ) : (
          <span className="rounded-full border border-dashed border-[var(--linea)] px-5 py-2.5 text-[var(--gris)]">💬 WhatsApp: próximamente</span>
        )}
        <a href={`mailto:${SITIO.emailEnvio}?subject=${asunto}&body=${cuerpo}`} className="rounded-full border border-[var(--linea)] bg-white px-5 py-2.5 font-medium hover:border-[var(--tinta)]">
          ✉️ Por email
        </a>
      </div>
      <p className="mt-6 text-sm text-[var(--gris)]">
        ¿Tienes web? Pon la agenda de tu zona con el <a href="/widget" className="underline">widget gratuito</a>.
      </p>
    </div>
  );
}
