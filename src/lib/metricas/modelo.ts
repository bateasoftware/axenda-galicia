// Métricas propias por evento: lo que se puede enseñar (y vender) a organizadores y comercios.
// Sin cookies ni datos personales: solo contadores agregados por día. No se guarda IP, ni navegador, ni identificador.
import { slugConcello } from "../slug";
import type { Evento } from "../tipos";

/** Qué se cuenta */
export const TIPOS = ["vista", "clic", "impresion", "como-llegar", "calendario", "inscripcion", "compartir"] as const;
export type TipoMetrica = (typeof TIPOS)[number];

export const NOMBRE_TIPO: Record<TipoMetrica, string> = {
  vista: "Visitas a la ficha",
  clic: "Clics desde listados",
  impresion: "Apariciones en listados",
  "como-llegar": "Pidieron cómo llegar",
  calendario: "Añadieron al calendario",
  inscripcion: "Fueron a inscribirse",
  compartir: "Compartieron",
};

/** Por qué se agrega cada contador */
export type Ambito = "total" | "evento" | "organizador" | "concello" | "categoria" | "segmento";

/** Una fila de contador: (día, ámbito, clave, tipo) → n */
export type Fila = { dia: string; ambito: Ambito; clave: string; tipo: TipoMetrica; n: number };

export type Hit = { tipo: TipoMetrica; evento: Evento };

/** ¿Está destacado ese día? `destacado_hasta` es el último día incluido */
export const esDestacado = (e: Pick<Evento, "destacado_hasta">, dia: string) => !!e.destacado_hasta && e.destacado_hasta >= dia;

/** Convierte los hits de una petición en filas agregadas (una por día, ámbito, clave y tipo) */
export function filasDeHits(hits: Hit[], dia: string): Fila[] {
  const m = new Map<string, Fila>();
  const sumar = (ambito: Ambito, clave: string, tipo: TipoMetrica) => {
    const k = `${ambito}\u0000${clave}\u0000${tipo}`;
    const f = m.get(k);
    if (f) f.n++;
    else m.set(k, { dia, ambito, clave, tipo, n: 1 });
  };
  for (const { tipo, evento: e } of hits) {
    sumar("total", "todo", tipo);
    sumar("evento", e.slug, tipo);
    sumar("concello", slugConcello(e.concello), tipo);
    sumar("segmento", esDestacado(e, dia) ? "destacado" : "normal", tipo);
    for (const o of new Set(e.organizadores.map(slugConcello))) if (o.replace(/-/g, "")) sumar("organizador", o, tipo);
    for (const c of new Set(e.categorias)) sumar("categoria", c, tipo);
  }
  return [...m.values()];
}

/** Navegadores automáticos, buscadores, previsualizaciones de enlaces y herramientas: no cuentan */
const RE_BOT =
  /bot|crawl|spider|slurp|scrap|preview|facebookexternalhit|whatsapp|telegram|discord|slack|skype|embedly|quora|pinterest|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|python|curl|wget|httpie|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|perl|ruby|php|postman|insomnia|vercel/i;
export const esBot = (ua: string | null) => !ua || ua.length < 20 || RE_BOT.test(ua);

/** Suma filas por una clave (p. ej. para tablas y gráficos) */
export function sumarPor<K extends string>(filas: Fila[], clave: (f: Fila) => K | null): Map<K, Record<TipoMetrica, number>> {
  const m = new Map<K, Record<TipoMetrica, number>>();
  for (const f of filas) {
    const k = clave(f);
    if (k === null) continue;
    const r = m.get(k) ?? (Object.fromEntries(TIPOS.map((t) => [t, 0])) as Record<TipoMetrica, number>);
    r[f.tipo] += f.n;
    m.set(k, r);
  }
  return m;
}
