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

/** Fecha y hora de Galicia como "YYYY-MM-DDTHH:MM" (para la hora de recepción de un cartel) */
export function fechaHoraGalicia(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })
    .format(fecha)
    .replace(" ", "T");
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

/** Desfase de Madrid (+01:00 o +02:00) para una hora local "YYYY-MM-DDTHH:MM" */
export function desfaseMadrid(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const h = Number(iso.slice(11, 13) || 12);
  // Se mira el desfase una hora antes en UTC: cubre bien los dos cambios de hora salvo la hora ambigua
  const parte = new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" })
    .formatToParts(new Date(Date.UTC(y, m - 1, d, h - 1)))
    .find((p) => p.type === "timeZoneName")?.value; // "GMT+1"
  const n = Number(parte?.replace("GMT", "") || 1);
  return `+${String(n).padStart(2, "0")}:00`;
}

/** "2026-11-22T17:00" → "2026-11-22T17:00:00+01:00" (para schema.org) */
export function conZona(iso: string): string {
  const local = iso.length > 10 ? iso : `${iso}T00:00`;
  return `${local}:00${desfaseMadrid(local)}`;
}

/** Suma horas a una hora local sin zona, sin pasar por la zona del sistema */
export function sumarHoras(iso: string, horas: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const [hh, mm] = iso.slice(11, 16).split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + horas, mm)).toISOString().slice(0, 16);
}

/** Hora local de Madrid → UTC en formato iCalendar ("20261119T085200Z") */
function utcICS(iso: string): string {
  const n = Number(desfaseMadrid(iso).slice(1, 3));
  return sumarHoras(iso, -n).replace(/[-:]/g, "") + "00Z";
}

// Definición de Europe/Madrid que exige RFC 5545 cuando se usa TZID
const VTIMEZONE_MADRID = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Corta una línea en trozos de 75 bytes como máximo (RFC 5545 §3.1) sin partir caracteres UTF-8 */
function plegar(linea: string): string {
  const enc = new TextEncoder();
  const trozos: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const ch of linea) {
    const b = enc.encode(ch).length;
    const limite = trozos.length ? 74 : 75; // las de continuación empiezan con un espacio
    if (bytes + b > limite) {
      trozos.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += ch;
    bytes += b;
  }
  trozos.push(actual);
  return trozos.join("\r\n ");
}

/** Fichero .ics (RFC 5545) con las horas en Europe/Madrid */
export function generarICS(e: Evento, url: string): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").slice(0, 13) + "00";
  const esc = (t: string) => t.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lugar = e.lugares.map((l) => [l.nombre, l.direccion].filter(Boolean).join(", ")).join(" / ");
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Axenda//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...VTIMEZONE_MADRID];
  e.sesiones.forEach((s, i) => {
    // Sin hora de fin, se supone una duración de 2 horas
    const fin = s.fin ?? sumarHoras(s.inicio, 2);
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${e.slug}-${i}@axenda`,
      `DTSTAMP:${utcICS(e.fuente.recibido)}`,
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
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
