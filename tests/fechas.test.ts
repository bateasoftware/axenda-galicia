import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  conZona,
  desfaseMadrid,
  diasDelEvento,
  fechaCorta,
  fechaLarga,
  generarICS,
  hora,
  nombreMes,
  primerInicio,
  rangoFinde,
  sumarHoras,
  ultimoFin,
} from "../src/lib/fechas";
import { evento } from "./ayudas";

describe("formato de fechas", () => {
  test("fechaLarga, fechaCorta, hora y nombreMes", () => {
    assert.equal(fechaLarga("2026-11-22T17:00"), "domingo 22 de noviembre");
    assert.equal(fechaCorta("2026-11-22T17:00"), "22 nov");
    assert.equal(hora("2026-11-22T17:00"), "17:00");
    assert.equal(hora("2026-11-22"), "");
    assert.equal(nombreMes(2026, 12), "Diciembre 2026");
  });

  test("primerInicio y ultimoFin usan la primera y la última sesión", () => {
    const e = evento({ sesiones: [{ inicio: "2026-11-27T10:00" }, { inicio: "2026-11-28T10:00", fin: "2026-11-28T14:00" }] });
    assert.equal(primerInicio(e), "2026-11-27T10:00");
    assert.equal(ultimoFin(e), "2026-11-28T14:00");
    assert.equal(ultimoFin(evento()), "2026-11-22T17:00", "sin fin, vale el inicio");
  });
});

describe("rangoFinde (viernes a domingo)", () => {
  const casos: [string, string, [string, string]][] = [
    ["lunes", "2026-11-23", ["2026-11-27", "2026-11-29"]],
    ["jueves", "2026-11-26", ["2026-11-27", "2026-11-29"]],
    ["viernes", "2026-11-27", ["2026-11-27", "2026-11-29"]],
    ["sábado", "2026-11-28", ["2026-11-27", "2026-11-29"]],
    ["domingo", "2026-11-29", ["2026-11-27", "2026-11-29"]],
    ["cruzando de mes", "2026-12-29", ["2027-01-01", "2027-01-03"]],
  ];
  for (const [nombre, hoy, esperado] of casos) test(nombre, () => assert.deepEqual(rangoFinde(hoy), esperado));
});

describe("diasDelEvento", () => {
  test("una sesión de un día", () => {
    assert.deepEqual(diasDelEvento(evento()), ["2026-11-22"]);
  });

  test("sesión de varios días que cruza de mes", () => {
    const e = evento({ sesiones: [{ inicio: "2026-11-29T10:00", fin: "2026-12-02T20:00" }] });
    assert.deepEqual(diasDelEvento(e), ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  test("varias sesiones el mismo día no repiten fecha y salen ordenadas", () => {
    const e = evento({
      sesiones: [{ inicio: "2026-12-05T18:00" }, { inicio: "2026-11-22T17:00" }, { inicio: "2026-11-22T18:00" }],
    });
    assert.deepEqual(diasDelEvento(e), ["2026-11-22", "2026-12-05"]);
  });
});

describe("zona horaria de Madrid", () => {
  const casos: [string, string][] = [
    ["2026-11-22T17:00", "+01:00"], // invierno
    ["2026-07-01T12:00", "+02:00"], // verano
    ["2026-03-29T01:30", "+01:00"], // antes del cambio de marzo (02:00 → 03:00)
    ["2026-03-29T03:30", "+02:00"], // después
    ["2026-10-25T01:30", "+02:00"], // antes del cambio de octubre (03:00 → 02:00)
    ["2026-10-25T03:30", "+01:00"], // después
  ];
  for (const [iso, desfase] of casos) test(`desfase de ${iso}`, () => assert.equal(desfaseMadrid(iso), desfase));

  test("conZona añade segundos y desfase", () => {
    assert.equal(conZona("2026-11-22T17:00"), "2026-11-22T17:00:00+01:00");
    assert.equal(conZona("2026-07-01"), "2026-07-01T00:00:00+02:00");
  });

  test("sumarHoras cruza medianoche y año", () => {
    assert.equal(sumarHoras("2026-12-31T23:00", 2), "2027-01-01T01:00");
    assert.equal(sumarHoras("2026-11-22T00:30", -1), "2026-11-21T23:30");
  });
});

describe("generarICS", () => {
  const url = "https://axenda.test/evento/prueba-2026";
  const ics = generarICS(
    evento({
      resumen: `Magosto, castañas; música y ${"ñ".repeat(60)}`,
      sesiones: [{ inicio: "2026-11-22T17:00", nota: "Magosto" }, { inicio: "2026-11-22T23:00" }],
    }),
    url,
  );
  const lineas = ics.split("\r\n");
  // Se despliegan las líneas plegadas para comprobar su contenido
  const desplegado = ics.replace(/\r\n /g, "");

  test("usa CRLF y termina en salto de línea", () => {
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.ok(!/[^\r]\n/.test(ics), "no hay saltos sin \\r");
  });

  test("ninguna línea pasa de 75 bytes, aunque haya tildes y eñes", () => {
    for (const l of lineas) assert.ok(Buffer.byteLength(l) <= 75, `línea de ${Buffer.byteLength(l)} bytes: ${l}`);
  });

  test("incluye la definición de Europe/Madrid", () => {
    assert.match(ics, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Madrid/);
    assert.match(ics, /RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU/);
    assert.match(ics, /RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU/);
  });

  test("un VEVENT por sesión, con hora local y fin por defecto de 2 horas", () => {
    assert.equal(desplegado.match(/BEGIN:VEVENT/g)?.length, 2);
    assert.match(desplegado, /DTSTART;TZID=Europe\/Madrid:20261122T170000\r\nDTEND;TZID=Europe\/Madrid:20261122T190000/);
    assert.match(desplegado, /DTEND;TZID=Europe\/Madrid:20261123T010000/, "cruza medianoche");
    assert.match(desplegado, /SUMMARY:Evento de prueba – Magosto/);
  });

  test("DTSTAMP en UTC a partir de la hora de recepción", () => {
    assert.match(desplegado, /DTSTAMP:20261119T085200Z/);
  });

  test("escapa comas, puntos y coma y saltos de línea", () => {
    assert.match(desplegado, /DESCRIPTION:Magosto\\, castañas\\; música/);
    assert.ok(desplegado.includes(`\\n${url}`));
  });
});
