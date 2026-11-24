// Modelo de datos de un evento. El extractor de carteles genera exactamente esta forma.

export type Sesion = {
  /** ISO local sin zona, p. ej. "2026-11-22T17:00" (hora de Galicia) */
  inicio: string;
  fin?: string;
  /** Qué pasa en esa sesión, si el cartel trae programa por horas */
  nota?: string;
};

export type Lugar = {
  nombre: string;
  direccion?: string;
  lat: number;
  lng: number;
  /** true si las coordenadas son aproximadas y conviene revisarlas */
  aprox?: boolean;
};

export type Inscripcion = {
  url?: string;
  telefono?: string;
  email?: string;
  /** Fecha límite YYYY-MM-DD */
  hasta?: string;
};

export type Categoria =
  | "navidad"
  | "fiestas"
  | "musica"
  | "cine"
  | "teatro"
  | "infantil"
  | "deporte"
  | "solidario"
  | "mercadillo"
  | "gastronomia"
  | "cultura"
  | "comercial";

export type Evento = {
  slug: string;
  titulo: string;
  /** Título en gallego si el cartel está en gallego o lo traducimos */
  titulo_gl?: string;
  resumen: string;
  sesiones: Sesion[];
  lugares: Lugar[];
  concello: string;
  parroquia?: string;
  organizadores: string[];
  categorias: Categoria[];
  publico?: string;
  precio?: string;
  inscripcion?: Inscripcion;
  extras?: string[];
  /** Ruta pública del cartel, p. ej. "/carteles/xxx.jpg" */
  cartel?: string;
  idioma: "gl" | "es" | "mixto";
  fuente: { canal: "whatsapp" | "formulario" | "email" | "manual"; recibido: string };
  /** Campos deducidos, no leídos literalmente (para revisar) */
  inferido?: string[];
  /** 0–1: seguridad de la extracción */
  confianza: number;
  /** Evento que se repite cada año (XVI edición, "un año más"…) */
  recurrente?: boolean;
  /** true si es promoción de un negocio */
  comercial?: boolean;
};
