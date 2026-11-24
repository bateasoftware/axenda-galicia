// Detección de posibles duplicados (se completa en el bloque de deduplicación).
import type { Almacen } from "./almacen";
import type { EventoBorrador } from "./tipos";

export async function buscadorDuplicados(almacen: Almacen): Promise<(e: EventoBorrador) => string[]> {
  void almacen;
  return () => [];
}
