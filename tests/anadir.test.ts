import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { construirBorrador } from "../src/lib/anadir";

const ctx = { canal: "whatsapp" as const, recibido: "2026-11-24T10:00" };
const minimo = {
  titulo: "Magosto de Panxón",
  resumen: "Castañas, música y juegos para toda la familia.",
  sesiones: [{ inicio: "2026-11-29T17:00" }],
  lugares: [{ nombre: "Parque da Ramallosa" }],
  concello: "Nigrán",
  categorias: ["gastronomia", "infantil"],
};

describe("construirBorrador", () => {
  test("con lo mínimo sale un borrador válido: slug, coordenadas y origen se completan", () => {
    const r = construirBorrador(minimo, { ...ctx, url: "https://www.nigran.es/magosto" });
    assert.deepEqual(r.errores, []);
    const e = r.evento!;
    assert.equal(e.slug, "magosto-de-panxon-2026");
    assert.equal(e.lugares[0].aprox, true, "sitio nuevo: centro del concello, aproximada");
    assert.ok(e.inferido!.some((x) => x.includes("coordenadas")));
    assert.deepEqual(e.fuente, { canal: "whatsapp", recibido: "2026-11-24T10:00", url: "https://www.nigran.es/magosto" });
    assert.equal(e.idioma, "es");
    assert.equal(e.confianza, 0.8);
    assert.deepEqual(e.organizadores, []);
  });

  test("sesiones solo con día (varios días sin hora)", () => {
    const r = construirBorrador({ ...minimo, sesiones: [{ inicio: "2026-08-13", fin: "2026-08-23" }] }, ctx);
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.evento!.sesiones, [{ inicio: "2026-08-13", fin: "2026-08-23" }]);
  });

  test("coordenadas escritas se respetan", () => {
    const r = construirBorrador({ ...minimo, lugares: [{ nombre: "Praza", lat: 42.1, lng: -8.7 }] }, ctx);
    assert.deepEqual(r.evento!.lugares, [{ nombre: "Praza", lat: 42.1, lng: -8.7 }]);
    assert.ok(!r.evento!.inferido);
  });

  test("un campo mal escrito o una categoría inexistente se detecta", () => {
    assert.ok(construirBorrador({ ...minimo, titulos: "x" }, ctx).errores.length > 0);
    assert.ok(construirBorrador({ ...minimo, categorias: ["fiestaaa"] }, ctx).errores.length > 0);
    assert.ok(construirBorrador({ ...minimo, sesiones: [] }, ctx).errores.length > 0);
  });

  test("un concello que no conocemos exige coordenadas", () => {
    const r = construirBorrador({ ...minimo, concello: "Lugo" }, ctx);
    assert.match(r.errores[0], /concello/);
  });

  test("las fechas mal escritas las atrapa la validación", () => {
    const r = construirBorrador({ ...minimo, sesiones: [{ inicio: "29/11" }] }, ctx);
    assert.ok(r.errores.length > 0);
  });
});
