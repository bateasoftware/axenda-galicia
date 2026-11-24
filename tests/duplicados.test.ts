import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { almacenLocal } from "../src/lib/almacen";
import { coincidencias, diasDe, duplicadosEntrePendientes, esDuplicadoSeguro, parecidoTitulos } from "../src/lib/duplicados";
import { evento } from "./ayudas";

describe("parecidoTitulos", () => {
  test("el mismo evento con otras palabras", () => {
    assert.ok(parecidoTitulos("Encendido de luces de Navidad", "Acendido das luces de Nadal") >= 0.5);
    assert.ok(parecidoTitulos("Magosto popular de Panxón", "Magosto") >= 0.8);
    assert.ok(parecidoTitulos("Torneo escolar de tenis solidario", "Torneo de tenis solidario escolar 2026") >= 0.85);
  });
  test("eventos distintos", () => {
    assert.ok(parecidoTitulos("Concierto de la banda municipal", "Mercadillo de Navidad") < 0.5);
    assert.ok(parecidoTitulos("Cine: La buena hija", "Cuentacuentos en la biblioteca") < 0.5);
  });
});

test("diasDe cuenta los días intermedios", () => {
  assert.deepEqual([...diasDe({ sesiones: [{ inicio: "2026-12-05T10:00", fin: "2026-12-07T20:00" }] })], ["2026-12-05", "2026-12-06", "2026-12-07"]);
});

describe("coincidencias", () => {
  const publicado = { ref: "evento:magosto-panxon-2026", evento: evento({ titulo: "Magosto popular de Panxón", concello: "Nigrán", sesiones: [{ inicio: "2026-11-08T17:00" }] }) };
  test("mismo día, concello y título parecido", () => {
    const r = coincidencias(evento({ titulo: "Magosto en Panxón", concello: "Nigrán", sesiones: [{ inicio: "2026-11-08T18:00" }] }), [publicado]);
    assert.equal(r[0]?.ref, "evento:magosto-panxon-2026");
  });
  test("otro día u otro concello no es duplicado", () => {
    assert.deepEqual(coincidencias(evento({ titulo: "Magosto popular de Panxón", concello: "Nigrán", sesiones: [{ inicio: "2026-11-09T17:00" }] }), [publicado]), []);
    assert.deepEqual(coincidencias(evento({ titulo: "Magosto popular de Panxón", concello: "Baiona", sesiones: [{ inicio: "2026-11-08T17:00" }] }), [publicado]), []);
  });
  test("solo los casi idénticos son seguros", () => {
    assert.equal(esDuplicadoSeguro(evento({ titulo: "Magosto popular de Panxón 2026", concello: "Nigrán", sesiones: [{ inicio: "2026-11-08T17:00" }] }), [publicado]), publicado.ref);
    assert.equal(esDuplicadoSeguro(evento({ titulo: "Magosto en la playa", concello: "Nigrán", sesiones: [{ inicio: "2026-11-08T17:00" }] }), [publicado]), null);
  });
});

test("duplicadosEntrePendientes compara con los publicados y con otros pendientes", async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "axenda-"));
  try {
    const a = almacenLocal(raiz);
    fs.mkdirSync(path.join(raiz, "data", "eventos"), { recursive: true });
    fs.writeFileSync(path.join(raiz, "data", "eventos", "acendido-2026.json"), JSON.stringify(evento({ slug: "acendido-2026", titulo: "Acendido de Nadal", concello: "Gondomar" })));
    await a.crear({ evento: evento({ slug: "encendido", titulo: "Acendido do Nadal en Gondomar", concello: "Gondomar" }) });
    await a.crear({ evento: evento({ slug: "otro", titulo: "Partido solidario", concello: "Gondomar" }) });
    const lista = await duplicadosEntrePendientes(a);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].id, "encendido");
    await a.marcarDuplicados("encendido", lista[0].coincidencias.map((c) => c.ref));
    assert.deepEqual((await a.pendiente("encendido"))?.duplicados, ["evento:acendido-2026"]);
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});
