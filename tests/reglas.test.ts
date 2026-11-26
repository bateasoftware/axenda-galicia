import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pendiente, RegistroCobertura } from "../src/lib/almacen";
import { esDuplicado, filtrarCola, filtroSeguro, ordenarCola, vecinos } from "../src/lib/admin/cola";
import { ReglaSchema, cumpleRegla, historialPorEmisor, pendientesDeConfianza } from "../src/lib/admin/reglas";
import { slugLibre } from "../src/lib/almacen";
import { evento as eventoBase } from "./ayudas";

const pend = (id: string, extra: Record<string, unknown> = {}, p: Partial<Pendiente> = {}): Pendiente => ({
  id,
  evento: { ...eventoBase(), slug: `ev-${id}`, fuente: { canal: "ics", recibido: "2026-11-01T10:00", id_fuente: "cultura-gal" }, confianza: 0.95, ...extra } as Pendiente["evento"],
  duplicados: [],
  creado: "2026-11-01T10:00:00Z",
  ...p,
});
const registros = (publicados: number, descartados: number, id_fuente = "cultura-gal"): RegistroCobertura[] => [
  ...Array.from({ length: publicados }, () => ({ estado: "publicado" as const, canal: "ics" as const, id_fuente, concello: "Baiona", recibido: "2026-10-01T10:00" })),
  ...Array.from({ length: descartados }, () => ({ estado: "descartado" as const, canal: "ics" as const, id_fuente, concello: "Baiona", recibido: "2026-10-01T10:00" })),
];
const regla = ReglaSchema.parse({ emisor: "cultura-gal" });

test("el historial cuenta publicados y descartados por emisor (los pendientes no cuentan)", () => {
  const h = historialPorEmisor([...registros(3, 1), { estado: "pendiente", canal: "ics", id_fuente: "cultura-gal", concello: "x", recibido: "x" }, ...registros(2, 0, "otra")]);
  assert.deepEqual(h.get("cultura-gal"), { publicados: 3, descartados: 1 });
  assert.deepEqual(h.get("otra"), { publicados: 2, descartados: 0 });
});

test("cumple la regla con historial limpio y confianza alta", () => {
  assert.equal(cumpleRegla(pend("a"), [regla], historialPorEmisor(registros(10, 0))).ok, true);
});

test("no cumple: sin regla, pocos publicados, muchos descartes, confianza baja, deducidos o por completar", () => {
  const limpio = historialPorEmisor(registros(10, 0));
  const motivo = (p: Pendiente, h = limpio) => {
    const r = cumpleRegla(p, [regla], h);
    return r.ok ? "ok" : r.motivo;
  };
  assert.match(cumpleRegla(pend("a", {}, {}), [], limpio).ok ? "ok" : "sin regla", /sin regla/);
  assert.match(motivo(pend("a"), historialPorEmisor(registros(3, 0))), /pocos publicados/);
  assert.match(motivo(pend("a"), historialPorEmisor(registros(8, 4))), /descartados/);
  assert.match(motivo(pend("a", { confianza: 0.7 })), /confianza 70 %/);
  assert.match(motivo(pend("a", { inferido: ["hora"] })), /deducidos/);
  assert.match(motivo(pend("a", { inferido: ["POR COMPLETAR"] })), /completar|deducidos/);
});

test("permitir_deducidos deja pasar los deducidos", () => {
  const r = ReglaSchema.parse({ emisor: "cultura-gal", permitir_deducidos: true });
  assert.equal(cumpleRegla(pend("a", { inferido: ["hora"] }), [r], historialPorEmisor(registros(10, 0))).ok, true);
});

test("de confianza: además deben pasar el lote (sin duplicados ni errores)", () => {
  const h = historialPorEmisor(registros(10, 0));
  const lista = [pend("a"), pend("b", {}, { duplicados: ["evento:otro"] }), pend("c", { titulo: "" })];
  const ids = pendientesDeConfianza(lista, [regla], h, () => false, slugLibre).map((p) => p.id);
  assert.deepEqual(ids, ["a"]);
  assert.deepEqual(pendientesDeConfianza(lista, [], h, () => false, slugLibre), [], "sin reglas no se ofrece nada");
});

test("cola: orden por fecha, filtros y vecinos", () => {
  const f = (inicio: string) => ({ sesiones: [{ inicio }] });
  const todos = [pend("c", f("2026-12-03")), pend("a", f("2026-12-01")), pend("b", f("2026-12-02"), { duplicados: ["x"] })];
  const cola = ordenarCola(todos);
  assert.deepEqual(cola.map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(filtrarCola(cola, { ver: "duplicados" }).map((p) => p.id), ["b"]);
  assert.equal(esDuplicado(cola[1]), true);
  assert.deepEqual(filtrarCola(cola, { emisor: "nada" }), []);
  const v = vecinos(cola, "b");
  assert.deepEqual([v.anterior?.id, v.siguiente?.id, v.indice], ["a", "c", 1]);
  assert.equal(vecinos(cola, "c").siguiente?.id, "b", "al final, se vuelve al anterior");
  assert.equal(vecinos(cola, "z").siguiente?.id, "a", "si ya no está, el primero");
  assert.deepEqual(filtroSeguro("cultura-gal", "../x"), { emisor: "cultura-gal", ver: undefined });
});
