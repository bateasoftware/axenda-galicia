import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { filasALugares, filasASesiones, formularioAEvento, lugaresAFilas, sesionesAFilas, ubicarLugar } from "../src/lib/admin/formulario";
import { validarEvento } from "../src/lib/validacion";
import { evento } from "./ayudas";

const fila = (c: Partial<Parameters<typeof filasASesiones>[0][number]> = {}) => ({ dia: "", hora: "", finDia: "", finHora: "", nota: "", ...c });

describe("sesiones por campos", () => {
  test("solo el día: sin hora (exposición, feria, varios días)", () => {
    const r = filasASesiones([fila({ dia: "2026-08-13", finDia: "2026-08-23" })]);
    assert.deepEqual(r, { sesiones: [{ inicio: "2026-08-13", fin: "2026-08-23" }], errores: [] });
  });
  test("con hora y hora de fin el mismo día", () => {
    assert.deepEqual(filasASesiones([fila({ dia: "2026-11-22", hora: "17:00", finHora: "19:30", nota: "Magosto" })]).sesiones, [
      { inicio: "2026-11-22T17:00", fin: "2026-11-22T19:30", nota: "Magosto" },
    ]);
  });
  test("varios días con hora de inicio y fin", () => {
    assert.deepEqual(filasASesiones([fila({ dia: "2026-12-05", hora: "10:00", finDia: "2026-12-07", finHora: "20:00" })]).sesiones, [
      { inicio: "2026-12-05T10:00", fin: "2026-12-07T20:00" },
    ]);
  });
  test("las filas vacías se ignoran y los errores dicen qué falta", () => {
    assert.deepEqual(filasASesiones([fila(), fila({ dia: "2026-11-22" })]).sesiones.length, 1);
    assert.match(filasASesiones([fila({ hora: "10:00" })]).errores[0], /elige el día/);
    assert.match(filasASesiones([fila({ dia: "2026-11-22", finHora: "19:00" })]).errores[0], /hora de inicio/);
    assert.match(filasASesiones([fila({ dia: "2026-11-22", finDia: "2026-11-20" })]).errores[0], /anterior/);
  });
  test("ida y vuelta", () => {
    const sesiones = [{ inicio: "2026-08-13", fin: "2026-08-23" }, { inicio: "2026-11-22T17:00", fin: "2026-11-22T19:30", nota: "x" }, { inicio: "2026-12-24T09:05" }];
    assert.deepEqual(filasASesiones(sesionesAFilas(sesiones)).sesiones, sesiones);
  });
  test("un pendiente sin sesiones muestra una fila vacía", () => assert.equal(sesionesAFilas([]).length, 1));
});

describe("lugares sin escribir coordenadas", () => {
  test("lugar conocido: sus coordenadas", () => {
    const l = ubicarLugar("Cines Municipais da Ramallosa", "Nigrán");
    assert.equal(l?.nombre, "Cines Municipais da Ramallosa");
    assert.equal(l?.aprox, true);
  });
  test("lugar nuevo: centro del concello, aproximadas", () => {
    const { lugares, errores } = filasALugares([{ nombre: "Parque da Ramallosa", direccion: "", lat: "", lng: "", aprox: true }], "Nigrán");
    assert.deepEqual(errores, []);
    assert.equal(lugares[0].nombre, "Parque da Ramallosa");
    assert.equal(lugares[0].aprox, true);
    assert.ok(Math.abs(lugares[0].lat - 42.1417) < 0.01);
  });
  test("sin concello ni coordenadas, pide el concello (no las coordenadas)", () => {
    const { errores } = filasALugares([{ nombre: "Parque", direccion: "", lat: "", lng: "", aprox: true }], "");
    assert.match(errores[0], /elige el concello/);
  });
  test("coordenadas escritas a mano (con coma decimal) y dirección", () => {
    const { lugares, errores } = filasALugares([{ nombre: "Praza", direccion: "Rúa X", lat: "42,1115", lng: "-8,7608", aprox: false }], "");
    assert.deepEqual(errores, []);
    assert.deepEqual(lugares, [{ nombre: "Praza", direccion: "Rúa X", lat: 42.1115, lng: -8.7608 }]);
  });
  test("solo una coordenada es un error", () => assert.match(filasALugares([{ nombre: "P", direccion: "", lat: "42", lng: "", aprox: true }], "Nigrán").errores[0], /latitud y longitud/));
  test("ida y vuelta conserva si era aproximada", () => {
    const lugares = [{ nombre: "Praza", lat: 42.1, lng: -8.7, aprox: true }, { nombre: "Auditorio", lat: 42.14, lng: -8.8 }];
    assert.deepEqual(filasALugares(lugaresAFilas(lugares), "Nigrán").lugares, lugares);
  });
});

describe("formularioAEvento", () => {
  const original = evento({ inferido: ["año"], precio: "Gratis", fuente: { canal: "whatsapp", recibido: "2026-11-19T09:52" } });
  const f = new FormData();
  f.set("slug", "magosto-2026");
  f.set("titulo", " Magosto ");
  f.set("resumen", "Castañas y música.");
  f.set("ses_dia", "2026-11-22");
  f.set("ses_hora", "");
  f.set("ses_fin_dia", "");
  f.set("ses_fin_hora", "");
  f.set("ses_nota", "");
  f.set("lug_nombre", "Parque da Ramallosa");
  f.set("lug_direccion", "");
  f.set("lug_lat", "");
  f.set("lug_lng", "");
  f.set("lug_aprox", "1");
  f.set("concello", "Nigrán");
  f.set("organizadores", "ANPA, Concello de Nigrán");
  f.append("categorias", "gastronomia");
  f.append("categorias", "inventada");
  f.set("idioma", "gl");
  f.set("precio", "");
  f.set("inferido", "");

  test("rellenando lo mínimo (día, sitio, concello) sale un evento válido", () => {
    const { evento: e, errores } = formularioAEvento(f, original);
    assert.deepEqual(errores, []);
    assert.equal(e.titulo, "Magosto");
    assert.deepEqual(e.sesiones, [{ inicio: "2026-11-22" }]);
    assert.deepEqual(e.organizadores, ["ANPA", "Concello de Nigrán"]);
    assert.deepEqual(e.categorias, ["gastronomia"]);
    assert.deepEqual(e.fuente, original.fuente);
    assert.ok(validarEvento(e, null).ok);
  });
  test("vaciar un campo opcional lo quita", () => {
    const { evento: e } = formularioAEvento(f, original);
    assert.equal(e.precio, undefined);
    assert.equal(e.inferido, undefined);
  });
});
