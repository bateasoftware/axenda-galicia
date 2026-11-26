import type { MetadataRoute } from "next";
import { concellos, organizadores, todosLosEventos } from "@/lib/eventos";
import { SITIO } from "@/lib/sitio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: SITIO.url, changeFrequency: "daily", priority: 1 },
    { url: `${SITIO.url}/concellos`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITIO.url}/enviar`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITIO.url}/widget`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITIO.url}/exposiciones`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITIO.url}/anunciate`, changeFrequency: "weekly", priority: 0.4 },
    ...(await concellos()).map((c) => ({ url: `${SITIO.url}/concello/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(await organizadores()).map((o) => ({ url: `${SITIO.url}/organizador/${o.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...(await todosLosEventos()).map((e) => ({ url: `${SITIO.url}/evento/${e.slug}`, lastModified: e.fuente.recibido.slice(0, 10), priority: 0.6 })),
  ];
}
