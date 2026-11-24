"use client";

import Script from "next/script";
import { useState } from "react";

const MAX_BYTES = 4 * 1024 * 1024;
const campo = "w-full rounded-xl border border-[var(--linea)] bg-white px-3 py-2.5 text-[15px]";

/** Reduce las fotos grandes en el navegador (máx. 2000 px, JPEG) para no pasar de 4 MB */
async function reducir(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/") || f.size < 1.5 * 1024 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.85));
    return blob ?? f;
  } catch {
    return f; // formatos que el navegador no sabe abrir (p. ej. HEIC fuera de Safari)
  }
}

type Estado = { tipo: "inicial" } | { tipo: "enviando" } | { tipo: "ok"; eventos: number } | { tipo: "error"; motivo: string };

export default function FormularioEnvio({ turnstile }: { turnstile?: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const datos = new FormData(form);
    const archivo = datos.get("archivo");
    if (archivo instanceof File && archivo.size) {
      const reducido = await reducir(archivo);
      if (reducido.size > MAX_BYTES) return setEstado({ tipo: "error", motivo: "El archivo pasa de 4 MB. Prueba con una foto o un PDF más ligero." });
      datos.set("archivo", reducido, archivo.name.replace(/\.\w+$/, reducido === archivo ? "$&" : ".jpg"));
    }
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch("/api/enviar", { method: "POST", body: datos });
      const r = (await res.json()) as { estado: string; eventos?: number; motivo?: string };
      if (!res.ok || r.estado === "error") return setEstado({ tipo: "error", motivo: r.motivo ?? "No se ha podido enviar." });
      setEstado({ tipo: "ok", eventos: r.eventos ?? 1 });
      form.reset();
    } catch {
      setEstado({ tipo: "error", motivo: "Sin conexión. Prueba otra vez en un momento." });
    }
  }

  if (estado.tipo === "ok")
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-display text-xl">¡Recibido, gracias! 🙌</p>
        <p className="mt-1 text-sm">
          {estado.eventos > 1 ? `Hemos encontrado ${estado.eventos} eventos. ` : ""}Lo revisamos y, si nos has dejado tu email, te avisamos cuando esté publicado.
        </p>
        <button onClick={() => setEstado({ tipo: "inicial" })} className="mt-3 text-sm underline">
          Enviar otro
        </button>
      </div>
    );

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-[var(--linea)] bg-white p-4 sm:p-5">
      {turnstile && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />}
      <label className="block">
        <span className="text-sm font-medium">Cartel o programa</span>
        <span className="block text-xs text-[var(--gris)]">Foto (JPG, PNG) o PDF, hasta 4 MB. Si no tienes cartel, rellena los datos de abajo.</span>
        <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="mt-1 block w-full text-sm" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Qué</span>
          <input name="que" placeholder="Magosto popular, concierto, mercadillo…" className={campo} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cuándo</span>
          <input name="cuando" placeholder="Sábado 22 de noviembre a las 17:00" className={campo} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Dónde</span>
          <input name="donde" placeholder="Praza Paradela, Gondomar" className={campo} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Organiza</span>
          <input name="organiza" className={campo} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Tu email (opcional)</span>
          <input name="email" type="email" autoComplete="email" placeholder="Para avisarte al publicarlo" className={campo} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Algo más</span>
          <textarea name="mas" rows={2} placeholder="Precio, inscripción, web…" className={campo} />
        </label>
      </div>
      {/* Campo trampa para bots: las personas no lo ven */}
      <input name="web" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="permiso" value="si" required className="mt-1" />
        <span>Organizo el evento o tengo permiso para difundir este cartel. El email solo se usa para avisarme y se borra después.</span>
      </label>
      {turnstile && <div className="cf-turnstile" data-sitekey={turnstile} data-language="es" />}
      {estado.tipo === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {estado.motivo}
        </p>
      )}
      <button disabled={estado.tipo === "enviando"} className="w-full rounded-full bg-[var(--mar)] px-5 py-2.5 font-medium text-white disabled:opacity-60 sm:w-auto">
        {estado.tipo === "enviando" ? "Enviando… (puede tardar un minuto)" : "Enviar evento"}
      </button>
    </form>
  );
}
