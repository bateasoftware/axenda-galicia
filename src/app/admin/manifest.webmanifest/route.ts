import { SITIO } from "@/lib/sitio";

// Manifest propio del panel: «Axenda Admin» se instala aparte de la web y se abre directamente en /admin.
// No es privado (solo nombre e iconos); lo que hay detrás de /admin sigue pidiendo la contraseña.
export function GET() {
  return Response.json(
    {
      name: `${SITIO.nombre} · Panel`,
      short_name: "Axenda Admin",
      description: "Revisión y publicación de eventos",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#fcfaf6",
      theme_color: "#0b2545",
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
