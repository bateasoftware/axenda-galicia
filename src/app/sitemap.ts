import type { MetadataRoute } from "next";
import { concellos, todosLosEventos } from "@/lib/eventos";
import { SITIO } from "@/lib/sitio";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITIO.url, changeFrequency: "daily", priority: 1 },
    ...concellos().map((c) => ({ url: `${SITIO.url}/concello/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...todosLosEventos().map((e) => ({ url: `${SITIO.url}/evento/${e.slug}`, lastModified: e.fuente.recibido.slice(0, 10), priority: 0.6 })),
  ];
}
