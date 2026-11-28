// Configuración general. La marca (colores y símbolo) está en src/lib/marca.ts.
export const SITIO = {
  nombre: "altofalante",
  /** Lema de marca (propuesta de partida, se puede cambiar) */
  eslogan: "Que se saiba.",
  lema: "Qué hacer en Val Miñor y Vigo",
  descripcion:
    "Agenda de eventos de Baiona, Nigrán, Gondomar y Vigo: fiestas, cine, deporte, actividades infantiles y más, en mapa y calendario.",
  // Hasta tener dominio propio sigue siendo la dirección de Vercel (ver docs/pendientes-juan.md)
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://axenda-galicia.vercel.app",
  emailEnvio: process.env.NEXT_PUBLIC_EMAIL_ENVIO || "bateasoftware@gmail.com",
  zonaHoraria: "Europe/Madrid",
};
