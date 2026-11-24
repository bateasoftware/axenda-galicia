import type { Evento } from "./tipos";

// Las fechas se guardan como hora local de Galicia sin zona ("2026-11-22T17:00").
// Se comparan como texto, que funciona porque el formato es fijo.

export const primerInicio = (e: Evento) => e.sesiones[0]?.inicio ?? "";

export const ultimoFin = (e: Evento) => {
  const s = e.sesiones[e.sesiones.length - 1];
  return s?.fin ?? s?.inicio ?? "";
};

export const dia = (iso: string) => iso.slice(0, 10);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function partes(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, dow: fecha.getUTCDay() };
}

export function fechaLarga(iso: string) {
  const { m, d, dow } = partes(iso);
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]}`;
}

export const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function fechaCorta(iso: string) {
  const { m, d } = partes(iso);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

export const hora = (iso: string) => (iso.length > 10 ? iso.slice(11, 16) : "");

export function nombreMes(y: number, m: number) {
  return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
}

/** Días (YYYY-MM-DD) que ocupa un evento, para el calendario */
export function diasDelEvento(e: Evento): string[] {
  const set = new Set<string>();
  for (const s of e.sesiones) {
    const ini = dia(s.inicio);
    const fin = dia(s.fin ?? s.inicio);
    let cur = ini;
    let guard = 0;
    while (cur <= fin && guard++ < 60) {
      set.add(cur);
      const { y, m, d } = partes(cur);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      cur = next.toISOString().slice(0, 10);
    }
  }
  return [...set].sort();
}

/** Hoy en Galicia como YYYY-MM-DD (solo en cliente o en tiempo de petición) */
export function hoyGalicia(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

/** Fin de semana (viernes–domingo) que contiene o sigue a una fecha */
export function rangoFinde(hoy: string): [string, string] {
  const { y, m, d, dow } = partes(hoy);
  const offViernes = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  const vie = new Date(Date.UTC(y, m - 1, d + offViernes));
  const dom = new Date(Date.UTC(y, m - 1, d + offViernes + 2));
  return [vie.toISOString().slice(0, 10), dom.toISOString().slice(0, 10)];
}

/** Fichero .ics (RFC 5545) con hora flotante local */
export function generarICS(e: Evento, url: string): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").slice(0, 13) + "00";
  const esc = (t: string) => t.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lugar = e.lugares.map((l) => [l.nombre, l.direccion].filter(Boolean).join(", ")).join(" / ");
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Axenda//ES", "CALSCALE:GREGORIAN"];
  e.sesiones.forEach((s, i) => {
    const fin = s.fin ?? s.inicio.slice(0, 11) + String(Math.min(23, Number(s.inicio.slice(11, 13) || "10") + 2)).padStart(2, "0") + ":00";
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${e.slug}-${i}@axenda`,
      `DTSTAMP:${fmt(e.fuente.recibido)}Z`,
      `DTSTART;TZID=Europe/Madrid:${fmt(s.inicio)}`,
      `DTEND;TZID=Europe/Madrid:${fmt(fin)}`,
      `SUMMARY:${esc(s.nota ? `${e.titulo} – ${s.nota}` : e.titulo)}`,
      `LOCATION:${esc(`${lugar}, ${e.concello}`)}`,
      `DESCRIPTION:${esc(`${e.resumen}\n${url}`)}`,
      `URL:${url}`,
      "END:VEVENT",
    );
  });
  lineas.push("END:VCALENDAR");
  return lineas.join("\r\n");
}
