// Importador de boletines mensuales en PDF (p. ej. Axenda Saudable del SERGAS): descarga el del mes,
// la IA saca un evento por actividad y se guardan como pendientes. Una llamada a la IA por boletín nuevo.
import type { Almacen } from "../almacen";
import { buscadorDuplicados } from "../duplicados";
import { procesarEntrada } from "../entrada";
import { extraer } from "../extraccion";
import { fechaHoraGalicia } from "../fechas";
import { urlDelMes, type Fuente } from "../fuentes";
import { prepararArchivo } from "../recepcion";
import { IMPORTADORES_EXTRA, type ResultadoImportacion } from "./ejecutar";
import { USER_AGENT } from "./importadores";

export async function importarPdfMensual(
  fuente: Fuente,
  destino: Almacen,
  { simular, hoy }: { simular: boolean; hoy: string },
): Promise<ResultadoImportacion> {
  const [anio, mes] = hoy.split("-").map(Number);
  const url = urlDelMes(fuente.url_datos!, anio, mes);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 404) return { creados: [], yaVistos: 0, pasados: 0, nota: `aún no está el boletín de este mes (${url})` };
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);

  const preparado = await prepararArchivo(Buffer.from(await res.arrayBuffer()));
  if (await destino.yaVisto({ hash: preparado.hash })) return { creados: [], yaVistos: 1, pasados: 0, nota: "boletín ya importado" };
  if (simular) return { creados: [], yaVistos: 0, pasados: 0, nota: `hay boletín nuevo (${url}); la simulación no llama a la IA` };
  if (!process.env.ANTHROPIC_API_KEY) return { creados: [], yaVistos: 0, pasados: 0, nota: "falta ANTHROPIC_API_KEY para leer el PDF" };

  const r = await procesarEntrada(
    { ...preparado, canal: "programa-pdf", recibido: fechaHoraGalicia() },
    { almacen: destino, extraer: (e) => extraer(e), duplicados: await buscadorDuplicados(destino) },
  );
  if (r.estado === "rechazado") throw new Error(r.motivo);
  if (r.estado !== "creado") return { creados: [], yaVistos: 0, pasados: 0, nota: r.estado };

  // Origen y atribución en cada evento creado
  const creados: ResultadoImportacion["creados"] = [];
  for (const c of r.eventos) {
    const p = await destino.pendiente(c.id);
    if (!p) continue;
    const evento = {
      ...p.evento,
      fuente: { ...p.evento.fuente, id_fuente: fuente.id, url, ...(fuente.atribucion ? { atribucion: fuente.atribucion } : {}) },
    };
    await destino.guardar(c.id, evento);
    creados.push({ evento, duplicados: c.duplicados });
  }
  return { creados, yaVistos: 0, pasados: 0 };
}

IMPORTADORES_EXTRA["pdf-mensual"] = importarPdfMensual;
