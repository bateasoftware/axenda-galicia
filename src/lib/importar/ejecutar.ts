// Ejecuta un importador y guarda los candidatos nuevos como pendientes.
import type { Almacen } from "../almacen";
import type { Fuente } from "../fuentes";
import type { EventoBorrador } from "../tipos";
import { IMPORTADORES, type Candidato } from "./importadores";

export type ResultadoImportacion = {
  creados: { evento: EventoBorrador; duplicados: string[] }[];
  yaVistos: number;
  pasados: number;
  nota?: string;
};

/** Importadores que necesitan algo más que descargar (p. ej. IA); se registran desde fuera */
export const IMPORTADORES_EXTRA: Partial<Record<NonNullable<Fuente["importador"]>, (f: Fuente, a: Almacen, o: { simular: boolean; hoy: string }) => Promise<ResultadoImportacion>>> = {};

/** Busca posibles duplicados (se sustituye en el bloque de deduplicación) */
export type BuscadorDuplicados = (e: EventoBorrador) => string[];

export async function importarFuente(
  fuente: Fuente,
  destino: Almacen,
  { simular = false, hoy, duplicados = () => [] }: { simular?: boolean; hoy: string; duplicados?: BuscadorDuplicados },
): Promise<ResultadoImportacion> {
  const extra = fuente.importador && IMPORTADORES_EXTRA[fuente.importador];
  if (extra) return extra(fuente, destino, { simular, hoy });
  const importar = fuente.importador && IMPORTADORES[fuente.importador];
  if (!importar) throw new Error(`La fuente ${fuente.id} no tiene importador`);
  if (!fuente.url_datos) throw new Error(`La fuente ${fuente.id} no tiene url_datos`);

  const candidatos: Candidato[] = await importar(fuente);
  const r: ResultadoImportacion = { creados: [], yaVistos: 0, pasados: 0 };
  const vistos = new Set<string>();

  for (const c of candidatos) {
    const ses = c.evento.sesiones;
    const ultimo = ses[ses.length - 1];
    // Lo que ya terminó no interesa
    if ((ultimo.fin ?? ultimo.inicio).slice(0, 10) < hoy) {
      r.pasados++;
      continue;
    }
    if (vistos.has(c.uid) || (await destino.yaVisto({ id_fuente: fuente.id, uid: c.uid }))) {
      r.yaVistos++;
      continue;
    }
    vistos.add(c.uid);
    const dups = duplicados(c.evento);
    if (!simular) await destino.crear({ evento: c.evento, duplicados: dups });
    r.creados.push({ evento: c.evento, duplicados: dups });
  }
  return r;
}
