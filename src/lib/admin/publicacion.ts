// Lo que se muestra una vez tras publicar (en /admin/publicado/<slug>)

/** Resultado de publicar, que se enseña una vez en /admin/publicado (cookie de corta duración, nunca en la URL) */
export type ResultadoPublicacion = {
  slug: string;
  url: string;
  mensaje: string;
  /** Cómo se avisó a quien lo envió */
  aviso: { tipo: "whatsapp-enviado" } | { tipo: "whatsapp-error"; numero: string } | { tipo: "email"; email: string } | { tipo: "ninguno" };
  avisos: string[];
};
export const COOKIE_PUBLICADO = "axenda_publicado";
