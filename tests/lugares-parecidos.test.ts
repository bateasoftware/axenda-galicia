import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lugaresParecidos, parecidoLugares } from "../src/lib/lugares-parecidos";

const L = (nombre: string, concello = "Nigrán") => ({ nombre, concello, lat: 42.14, lng: -8.8 });
const lista = [
  L("Auditorio Municipal de Nigrán"),
  L("Cines Municipais da Ramallosa"),
  L("Praza Paradela", "Gondomar"),
  L("Pavillón de Panxón"),
  L("Igrexa de Camos"),
  L("Auditorio Municipal de Baiona", "Baiona"),
];
const nombres = (n: string, c: string) => lugaresParecidos(n, c, lista).map((l) => l.nombre);

describe("lugares con nombre parecido", () => {
  test("gallego y castellano, con o sin «municipal» y «de»", () => {
    assert.equal(parecidoLugares("Praza Paradela", "Plaza de Paradela"), 1);
    assert.equal(parecidoLugares("Igrexa de Camos", "Iglesia de Camos"), 1);
    assert.equal(parecidoLugares("Cine de la Ramallosa", "Cines Municipais da Ramallosa"), 1);
    assert.ok(parecidoLugares("Pabellón de Panxón", "Pavillón de Panxón") >= 0.9);
  });
  test("uno dentro del otro", () => {
    assert.deepEqual(nombres("Auditorio de Nigrán", "Nigrán"), ["Auditorio Municipal de Nigrán"]);
    assert.deepEqual(nombres("Auditorio", "Nigrán"), ["Auditorio Municipal de Nigrán"]);
  });
  test("faltas y abreviaturas", () => {
    assert.deepEqual(nombres("Cines da Ramalosa", "Nigrán"), ["Cines Municipais da Ramallosa"]);
    assert.deepEqual(nombres("Pza. Paradela", "Gondomar").length, 1);
  });
  test("solo del mismo concello, y no el que ya es igual", () => {
    assert.deepEqual(nombres("Auditorio de Baiona", "Baiona"), ["Auditorio Municipal de Baiona"]);
    assert.deepEqual(nombres("Auditorio Municipal de Nigrán", "Nigrán"), []);
  });
  test("lo que no se parece no se sugiere", () => {
    assert.deepEqual(nombres("Campo de fútbol de Montelourido", "Nigrán"), []);
    assert.deepEqual(nombres("Parque", "Nigrán"), []);
    assert.deepEqual(nombres("ab", "Nigrán"), []);
  });
});
