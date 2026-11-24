// Lector mínimo de calendarios iCalendar (RFC 5545): solo lo que necesitan los importadores.
import { fechaHoraGalicia } from "../fechas";

export type EventoICS = {
  uid: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  url?: string;
  /** YYYY-MM-DDTHH:MM en hora de Galicia */
  inicio: string;
  fin?: string;
  /** Evento de día completo (DTSTART;VALUE=DATE): no trae hora */
  sinHora: boolean;
  categorias: string[];
  /** Tiene RRULE: se repite (solo se importa la primera fecha) */
  recurrente: boolean;
};

/** Junta las líneas plegadas (las que empiezan por espacio o tabulador continúan la anterior) */
function desplegar(texto: string): string[] {
  return texto.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function desescapar(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

/** "20261122T170000Z" / "20261122T170000" / "20261122" → hora local de Galicia */
export function fechaICS(valor: string, params: Record<string, string>): { iso: string; sinHora: boolean } | null {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { iso: `${y}-${mo}-${d}`, sinHora: true };
  if (z) return { iso: fechaHoraGalicia(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))), sinHora: false };
  // Con TZID se asume Europe/Madrid (la de todas nuestras fuentes); flotante también
  void params;
  return { iso: `${y}-${mo}-${d}T${h}:${mi}`, sinHora: false };
}

export function leerICS(texto: string): EventoICS[] {
  const eventos: EventoICS[] = [];
  let actual: Record<string, { valor: string; params: Record<string, string> }> | null = null;

  for (const linea of desplegar(texto)) {
    if (linea === "BEGIN:VEVENT") {
      actual = {};
      continue;
    }
    if (linea === "END:VEVENT" && actual) {
      const p = actual;
      actual = null;
      const ini = p.DTSTART && fechaICS(p.DTSTART.valor, p.DTSTART.params);
      if (!ini || !p.SUMMARY) continue;
      let fin = p.DTEND && fechaICS(p.DTEND.valor, p.DTEND.params);
      // Fechas de fin absurdas (errores de la fuente, p. ej. año 2203): se ignoran
      if (fin && Number(fin.iso.slice(0, 4)) - Number(ini.iso.slice(0, 4)) > 1) fin = null;
      // En los de día completo DTEND es el día siguiente (exclusivo): se resta un día y, si es el mismo, sobra
      if (fin && ini.sinHora) {
        const d = new Date(`${fin.iso.slice(0, 10)}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        const ultimo = d.toISOString().slice(0, 10);
        fin = ultimo > ini.iso.slice(0, 10) ? { iso: ultimo, sinHora: true } : null;
      }
      eventos.push({
        uid: p.UID?.valor ?? `${p.DTSTART!.valor}-${p.SUMMARY.valor}`,
        titulo: desescapar(p.SUMMARY.valor),
        descripcion: p.DESCRIPTION ? desescapar(p.DESCRIPTION.valor) : undefined,
        lugar: p.LOCATION ? desescapar(p.LOCATION.valor).replace(/\s{2,}/g, " ") : undefined,
        url: p.URL?.valor.trim(),
        inicio: ini.iso,
        fin: fin && fin.iso > ini.iso ? fin.iso : undefined,
        sinHora: ini.sinHora,
        categorias: p.CATEGORIES ? desescapar(p.CATEGORIES.valor).split(",").map((c) => c.trim()).filter(Boolean) : [],
        recurrente: !!p.RRULE,
      });
      continue;
    }
    if (!actual) continue;
    const dosPuntos = linea.indexOf(":");
    if (dosPuntos < 1) continue;
    const [nombre, ...params] = linea.slice(0, dosPuntos).split(";");
    const valor = linea.slice(dosPuntos + 1);
    const p: Record<string, string> = {};
    for (const x of params) {
      const [k, v] = x.split("=");
      if (k && v) p[k.toUpperCase()] = v;
    }
    actual[nombre.toUpperCase()] = { valor, params: p };
  }
  return eventos;
}
