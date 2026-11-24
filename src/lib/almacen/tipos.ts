// Almacén de eventos pendientes de revisión y publicados.
// Dos implementaciones con la misma interfaz:
//  - local: ficheros en data/pendientes y data/eventos (scripts y desarrollo; git como CMS)
//  - supabase: tablas y Storage (lo que usa Vercel, donde no se puede escribir en disco)
import type { Canal, Evento, EventoBorrador } from "../tipos";

/** Datos de quien envía. PRIVADOS: solo para avisarle al publicar; nunca se publican ni van a un PR. */
export type Contacto = { canal: "whatsapp" | "email"; valor: string };

export type ImagenCartel = { datos: Buffer; tipo: "image/jpeg" | "image/png" | "image/webp" };

export type Pendiente = {
  id: string;
  evento: EventoBorrador;
  /** URL o ruta para ver el cartel en el panel */
  cartel?: string;
  /** Huella del fichero original, para detectar el mismo cartel dos veces */
  hash?: string;
  /** Posibles duplicados: "evento:<slug>" (publicado) o "pendiente:<id>" */
  duplicados: string[];
  contacto?: Contacto;
  /** ISO de creación */
  creado: string;
};

export type NuevoPendiente = {
  evento: EventoBorrador;
  cartel?: ImagenCartel;
  hash?: string;
  contacto?: Contacto;
  duplicados?: string[];
};

/** Lo mínimo de cada evento (en cualquier estado) para medir la cobertura */
export type RegistroCobertura = {
  estado: "pendiente" | "publicado" | "descartado";
  canal: Canal;
  id_fuente?: string;
  concello: string;
  /** Primera sesión YYYY-MM-DDTHH:MM (puede faltar en un borrador) */
  inicio?: string;
  /** Llegada YYYY-MM-DDTHH:MM */
  recibido: string;
};

export type ClaveOrigen = { hash?: string; id_fuente?: string; uid?: string };

/** Un evento ya publicado, con el id con el que se edita o se retira en el panel */
export type Publicado = { id: string; evento: Evento };

export interface Almacen {
  readonly tipo: "local" | "supabase" | "turso";
  pendientes(): Promise<Pendiente[]>;
  pendiente(id: string): Promise<Pendiente | null>;
  /** Eventos publicados que gestiona este almacén */
  publicados(): Promise<Evento[]>;
  /** ¿Ya llegó (en cualquier estado, también descartado)? Por hash del cartel o por fuente + uid */
  yaVisto(clave: ClaveOrigen): Promise<boolean>;
  crear(p: NuevoPendiente): Promise<Pendiente>;
  /** Guarda los cambios de la revisión (sin publicar) */
  guardar(id: string, evento: EventoBorrador): Promise<void>;
  /** Publica: el evento ya está validado. Devuelve el slug definitivo y el contacto para avisar. */
  publicar(id: string, evento: Evento): Promise<{ slug: string; contacto?: Contacto }>;
  descartar(id: string): Promise<void>;
  /** Sustituye la lista de posibles duplicados de un pendiente */
  marcarDuplicados(id: string, duplicados: string[]): Promise<void>;
  /** Pone (o cambia) el cartel de un pendiente o de un evento publicado. Devuelve su URL. */
  ponerCartel(id: string, cartel: ImagenCartel, estado: "pendiente" | "publicado"): Promise<string>;
  /** Publicados gestionados por este almacén, con su id (los de data/eventos solo en el almacén local) */
  publicadosConId(): Promise<Publicado[]>;
  publicado(id: string): Promise<Publicado | null>;
  /** Guarda los cambios de un evento ya publicado (el slug no cambia: la URL sigue siendo la misma) */
  guardarPublicado(id: string, evento: Evento): Promise<void>;
  /** Quita un evento de la web (queda guardado como descartado, no se borra) */
  retirar(id: string): Promise<void>;
  /** Copia a la base de datos un evento que vive en data/eventos (git), para poder editarlo; gana al de git */
  adoptar(evento: Evento): Promise<{ id: string }>;
  /** Oculta de la web un evento que vive en data/eventos (git) */
  retirarSlug(slug: string): Promise<void>;
  /** Slugs de data/eventos que están ocultos */
  slugsRetirados(): Promise<string[]>;
  /** Marca que ya se avisó al remitente (y borra su contacto) */
  olvidarContacto(id: string): Promise<void>;
  cobertura(): Promise<RegistroCobertura[]>;
}
