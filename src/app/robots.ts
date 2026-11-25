import type { MetadataRoute } from "next";
import { SITIO } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Privado o sin valor para buscadores: panel, API, informes de organizadores, widget (va dentro de otras webs) y .ics
      disallow: ["/admin", "/api/", "/informe/", "/widget/agenda", "/evento/*/calendario.ics"],
    },
    sitemap: `${SITIO.url}/sitemap.xml`,
    host: SITIO.url,
  };
}
