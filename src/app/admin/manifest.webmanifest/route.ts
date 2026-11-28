import { SITIO } from "@/lib/sitio";

// Manifest propio del panel: «altofalante admin» se instala aparte de la web y se abre directamente en /admin.
// No es privado (solo nombre e iconos); lo que hay detrás de /admin sigue pidiendo la contraseña.
export function GET() {
  return Response.json(
    {
      name: `${SITIO.nombre} · Panel`,
      short_name: "altofalante admin",
      description: "Revisión y publicación de eventos",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#f4f1ea",
      theme_color: "#f4f1ea",
      lang: "es",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
