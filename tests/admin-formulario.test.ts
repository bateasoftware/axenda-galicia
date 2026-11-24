import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formularioAEvento, lugaresATexto, sesionesATexto, textoALugares, textoASesiones } from "../src/lib/admin/formulario";
import { evento } from "./ayudas";

describe("sesiones en texto", () => {
  test("ida y vuelta", () => {
    const sesiones = [
      { inicio: "2026-11-22T17:00", fin: "2026-11-22T19:30", nota: "Magosto" },
      { inicio: "2026-12-05T10:00", fin: "2026-12-07T20:00" },
      { inicio: "2026-12-24T09:05" },
    ];
    const t = sesionesATexto(sesiones);
    assert.equal(t, "2026-11-22 17:00 - 19:30 | Magosto\n2026-12-05 10:00 - 2026-12-07 20:00\n2026-12-24 09:05");
    assert.deepEqual(textoASesiones(t), { sesiones, errores: [] });
  });
  test("horas de un dígito y errores claros", () => {
    assert.equal(textoASesiones("2026-11-22 9:30").sesiones[0].inicio, "2026-11-22T09:30");
    assert.match(textoASesiones("sábado por la tarde").errores[0], /Sesión 1/);
  });
});

describe("lugares en texto", () => {
  test("ida y vuelta con dirección y aprox", () => {
    const lugares = [
      { nombre: "Praza Paradela", lat: 42.1115, lng: -8.7608, direccion: "Gondomar", aprox: true },
      { nombre: "Auditorio", lat: 42.14, lng: -8.8 },
    ];
    const t = lugaresATexto(lugares);
    assert.equal(t, "Praza Paradela | 42.1115, -8.7608 | Gondomar | aprox\nAuditorio | 42.14, -8.8");
    assert.deepEqual(textoALugares(t), { lugares, errores: [] });
  });
  test("sin coordenadas es un error", () => assert.equal(textoALugares("Praza").errores.length, 1));
});

describe("formularioAEvento", () => {
  const original = evento({ inferido: ["año"], precio: "Gratis", fuente: { canal: "whatsapp", recibido: "2026-11-19T09:52" } });
  const f = new FormData();
  f.set("slug", "magosto-2026");
  f.set("titulo", " Magosto ");
  f.set("resumen", "Castañas y música.");
  f.set("sesiones", "2026-11-22 17:00");
  f.set("lugares", "Praza Paradela | 42.1115, -8.7608");
  f.set("concello", "Gondomar");
  f.set("organizadores", "ANPA, Concello de Gondomar");
  f.append("categorias", "gastronomia");
  f.append("categorias", "inventada");
  f.set("idioma", "gl");
  f.set("precio", "");
  f.set("inferido", "");

  test("lee los campos y conserva lo no editable", () => {
    const { evento: e, errores } = formularioAEvento(f, original);
    assert.deepEqual(errores, []);
    assert.equal(e.titulo, "Magosto");
    assert.deepEqual(e.organizadores, ["ANPA", "Concello de Gondomar"]);
    assert.deepEqual(e.categorias, ["gastronomia"]);
    assert.deepEqual(e.fuente, original.fuente);
    assert.equal(e.confianza, original.confianza);
  });
  test("vaciar un campo opcional lo quita", () => {
    const { evento: e } = formularioAEvento(f, original);
    assert.equal(e.precio, undefined);
    assert.equal(e.inferido, undefined);
  });
});
