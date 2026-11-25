"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";

// Analítica sin cookies ni datos personales (no hace falta banner de consentimiento):
//  - Vercel Web Analytics y Speed Insights: siempre (se activan en el panel de Vercel).
//  - Plausible o Umami: solo si están sus variables de entorno (alternativa o complemento).
// Se cargan después de la página, sin bloquearla. El panel /admin no se cuenta.

const enPanel = (url: string) => new URL(url).pathname.startsWith("/admin");

const PLAUSIBLE = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
const UMAMI = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js";

export default function Analitica() {
  return (
    <>
      <Analytics beforeSend={(e) => (enPanel(e.url) ? null : e)} />
      <SpeedInsights beforeSend={(e) => (enPanel(e.url) ? null : e)} />
      {PLAUSIBLE && <Script src={PLAUSIBLE_SRC} data-domain={PLAUSIBLE} strategy="lazyOnload" />}
      {UMAMI && <Script src={UMAMI_SRC} data-website-id={UMAMI} data-exclude-search="true" strategy="lazyOnload" />}
    </>
  );
}
