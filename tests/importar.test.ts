import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { almacenLocal } from "../src/lib/almacen";
import type { Fuente } from "../src/lib/fuentes";
import { leerICS } from "../src/lib/importar/ics";
import { categoriasDe, desdeICS, desdeVigo } from "../src/lib/importar/importadores";
import { importarFuente } from "../src/lib/importar/ejecutar";
import { ubicar } from "../src/lib/importar/ubicar";
import { validarEvento } from "../src/lib/validacion";

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:calendar.1@www.cultura.gal",
  "DTSTART;TZID=Europe/Madrid:20261128T200000",
  "DTEND;TZID=Europe/Madrid:20261128T213000",
  "SUMMARY:Retablo do Esperpento",
  "DESCRIPTION:Teatro para toda a familia\\, con moito humor.\\n\\n https://www.cu",
  " ltura.gal/gl/evento/1",
  "LOCATION:Auditorio Municipal de Nigrán - Nigrán   - Pontevedra",
  "URL;TYPE=URI:https://www.cultura.gal/gl/retablo",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:2",
  "DTSTART:20261201T190000Z",
  "SUMMARY:Concerto en Santiago",
  "LOCATION:Auditorio de Galicia - Santiago de Compostela - A Coruña",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:3",
  "DTSTART;VALUE=DATE:20261205",
  "DTEND;VALUE=DATE:20261206",
  "SUMMARY:Feira de Nadal",
  "LOCATION:Praza do Concello - Baiona - Pontevedra",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const fuente: Fuente = {
  id: "cultura-gal",
  nombre: "Cultura",
  tipo: "oficial",
  concello: "Galicia",
  url: "https://www.cultura.gal/gl/axenda",
  metodo: "ics",
  url_datos: "https://www.cultura.gal/gl/ical",
  importador: "ics",
  activa: true,
  frecuencia: "diaria",
  ultima_revision: null,
  estado: "verificada",
  atribucion: "Fuente: Cultura de Galicia",
};

describe("leerICS", () => {
  const eventos = leerICS(ICS);
  test("lee líneas plegadas, escapes y zonas", () => {
    assert.equal(eventos.length, 3);
    assert.equal(eventos[0].inicio, "2026-11-28T20:00");
    assert.equal(eventos[0].fin, "2026-11-28T21:30");
    assert.match(eventos[0].descripcion!, /familia, con moito humor/);
    assert.match(eventos[0].descripcion!, /cultura\.gal\/gl\/evento\/1$/);
  });
  test("UTC pasa a hora de Galicia", () => assert.equal(eventos[1].inicio, "2026-12-01T20:00"));
  test("día completo: sin hora y sin fin si es un solo día", () => {
    assert.equal(eventos[2].sinHora, true);
    assert.equal(eventos[2].fin, undefined);
  });
});

describe("ubicar", () => {
  test("lugar conocido de lugares.json", () => {
    const u = ubicar("Cines Municipais da Ramallosa - Nigrán");
    assert.equal(u?.lugar.nombre, "Cines Municipais da Ramallosa");
    assert.equal(u?.concello, "Nigrán");
  });
  test("parroquia", () => assert.equal(ubicar("Local social de Panxón")?.concello, "Nigrán"));
  test("concello por nombre, coordenadas aproximadas", () => {
    const u = ubicar("Praza do Concello - Baiona - Pontevedra");
    assert.equal(u?.concello, "Baiona");
    assert.equal(u?.lugar.nombre, "Praza do Concello");
    assert.equal(u?.lugar.aprox, true);
  });
  test("fuera de nuestra zona", () => assert.equal(ubicar("Auditorio de Galicia - Santiago de Compostela"), null));
});

describe("desdeICS", () => {
  const [a, b, c] = leerICS(ICS).map((e) => desdeICS(e, fuente, "2026-11-24T08:00"));
  test("filtra por concello y guarda origen y atribución", () => {
    assert.equal(b, null);
    assert.equal(a?.evento.concello, "Nigrán");
    assert.deepEqual(a?.evento.fuente, {
      canal: "ics",
      recibido: "2026-11-24T08:00",
      id_fuente: "cultura-gal",
      uid: "calendar.1@www.cultura.gal",
      url: "https://www.cultura.gal/gl/retablo",
      atribucion: "Fuente: Cultura de Galicia",
    });
  });
  test("resumen propio, nunca la descripción de la fuente", () => {
    assert.ok(!a!.evento.resumen.includes("moito humor"));
    assert.ok(a!.evento.inferido!.includes("resumen"));
  });
  test("el borrador es válido salvo lo que hay que revisar", () => {
    assert.ok(validarEvento(a!.evento, null).ok);
    assert.ok(c!.evento.inferido!.some((x) => x.startsWith("hora")));
    assert.deepEqual(c!.evento.categorias, ["navidad", "mercadillo"]);
  });
});

describe("desdeVigo", () => {
  const f = { ...fuente, id: "vigo", atribucion: "Fuente: Concello de Vigo (ODC-BY)" };
  test("ignora los permanentes y marca la hora como deducida", () => {
    assert.equal(desdeVigo({ id: 1, titulo: "Museo", fecha_inicio: null, fecha_fin: null, permanente: true, direccion: null, subcategoria: null }, f), null);
    const c = desdeVigo({ id: 2, titulo: "Concierto de la banda", fecha_inicio: "2026-11-24", fecha_fin: "2026-11-24", permanente: false, direccion: "Auditorio Mar de Vigo. Av. García Barbón", subcategoria: "2" }, f, "2026-11-24T08:00");
    assert.equal(c?.evento.concello, "Vigo");
    assert.equal(c?.evento.lugares[0].nombre, "Auditorio Mar de Vigo");
    assert.equal(c?.evento.fuente.canal, "datos-abiertos");
    assert.equal(c?.evento.fuente.atribucion, "Fuente: Concello de Vigo (ODC-BY)");
    assert.ok(validarEvento(c!.evento, null).ok);
  });
});

test("categoriasDe usa palabras en gallego y castellano", () => {
  assert.deepEqual(categoriasDe("Contacontos para nenos"), ["infantil"]);
  assert.deepEqual(categoriasDe("Algo sin pistas"), ["cultura"]);
});

describe("importarFuente con almacén local", () => {
  test("crea pendientes, salta los pasados y no repite lo ya visto ni lo descartado", async () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "axenda-"));
    const destino = almacenLocal(raiz);
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(ICS)) as typeof fetch;
    try {
      const r1 = await importarFuente(fuente, destino, { hoy: "2026-11-24" });
      assert.equal(r1.creados.length, 2);
      const r2 = await importarFuente(fuente, destino, { hoy: "2026-11-24" });
      assert.equal(r2.creados.length, 0);
      assert.equal(r2.yaVistos, 2);
      // Se descarta uno: no vuelve aunque se importe otra vez
      const [p] = await destino.pendientes();
      await destino.descartar(p.id);
      const r3 = await importarFuente(fuente, destino, { hoy: "2026-11-24" });
      assert.equal(r3.creados.length, 0);
      const r4 = await importarFuente(fuente, destino, { hoy: "2026-12-10" });
      assert.equal(r4.pasados, 2);
    } finally {
      globalThis.fetch = original;
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });
});
