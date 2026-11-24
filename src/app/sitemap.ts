import type { MetadataRoute } from "next";
import { concellos, todosLosEventos } from "@/lib/eventos";
import { SITIO } from "@/lib/sitio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: SITIO.url, changeFrequency: "daily", priority: 1 },
    { url: `${SITIO.url}/concellos`, changeFrequency: "weekly", priority: 0.7 },
    ...(await concellos()).map((c) => ({ url: `${SITIO.url}/concello/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(await todosLosEventos()).map((e) => ({ url: `${SITIO.url}/evento/${e.slug}`, lastModified: e.fuente.recibido.slice(0, 10), priority: 0.6 })),
  ];
}
