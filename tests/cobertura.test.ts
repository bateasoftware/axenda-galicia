import { test } from "node:test";
import assert from "node:assert/strict";
import { lunes, resumenCobertura } from "../src/lib/admin/cobertura";
import type { RegistroCobertura } from "../src/lib/almacen";

const r = (estado: RegistroCobertura["estado"], canal: RegistroCobertura["canal"], recibido: string, extra: Partial<RegistroCobertura> = {}): RegistroCobertura => ({
  estado,
  canal,
  concello: "Nigrán",
  recibido,
  ...extra,
});

test("lunes de la semana", () => {
  assert.equal(lunes("2026-11-24T10:00"), "2026-11-23");
  assert.equal(lunes("2026-11-29"), "2026-11-23");
  assert.equal(lunes("2026-11-23"), "2026-11-23");
});

test("resumen por canal, fuente, concello y semana", () => {
  const x = resumenCobertura(
    [
      r("publicado", "whatsapp", "2026-11-24T10:00"),
      r("publicado", "ics", "2026-11-17T10:00", { id_fuente: "cultura-gal" }),
      r("pendiente", "ics", "2026-11-24T10:00", { id_fuente: "cultura-gal", concello: "Vigo" }),
      r("descartado", "email", "2025-01-01T10:00"),
    ],
    "2026-11-25",
    4,
  );
  assert.equal(x.publicados, 2);
  assert.equal(x.directo, 50);
  assert.deepEqual(x.porCanal[0], { clave: "ics", publicado: 1, pendiente: 1, descartado: 0, total: 2 });
  assert.deepEqual(x.porFuente.map((f) => [f.clave, f.total]), [["cultura-gal", 2]]);
  assert.deepEqual(x.porConcello.map((f) => f.clave), ["Nigrán", "Vigo"]);
  assert.deepEqual(x.semanas.map((s) => [s.lunes, s.total]), [["2026-11-02", 0], ["2026-11-09", 0], ["2026-11-16", 1], ["2026-11-23", 2]]);
});
