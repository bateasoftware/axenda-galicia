// Configuración general. Cambia aquí el nombre cuando decidas la marca.
export const SITIO = {
  nombre: "Axenda",
  lema: "Qué hacer en Val Miñor y Vigo",
  descripcion:
    "Agenda de eventos de Baiona, Nigrán, Gondomar y Vigo: fiestas, cine, deporte, actividades infantiles y más, en mapa y calendario.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://axenda-galicia.vercel.app",
  emailEnvio: process.env.NEXT_PUBLIC_EMAIL_ENVIO || "bateasoftware@gmail.com",
  zonaHoraria: "Europe/Madrid",
};
