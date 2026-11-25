// Qué acepta /api/m (la ruta usa esto; sin base de datos configurada, además, no escribe nada)
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerPeticion } from "../src/lib/metricas/peticion";

const NAVEGADOR = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const cab = (extra: Record<string, string> = {}) => new Headers({ "user-agent": NAVEGADOR, origin: "https://axenda.test", host: "axenda.test", ...extra });

test("acepta lo válido y descarta tipos y slugs que no lo son", () => {
  assert.deepEqual(leerPeticion(cab(), '{"e":[["vista","magosto-2026"],["borrar","x"],["clic","../etc"],["impresion","a"]]}'), {
    pares: [["vista", "magosto-2026"], ["impresion", "a"]],
  });
});
test("bots, otras webs y peticiones sin origen no cuentan (204)", () => {
  assert.deepEqual(leerPeticion(cab({ "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }), '{"e":[["vista","a"]]}'), { estado: 204 });
  assert.deepEqual(leerPeticion(cab({ origin: "https://otra-web.com" }), '{"e":[["vista","a"]]}'), { estado: 204 });
  assert.deepEqual(leerPeticion(new Headers({ "user-agent": NAVEGADOR, host: "axenda.test" }), '{"e":[["vista","a"]]}'), { estado: 204 });
});
test("cuerpo mal formado: 400", () => {
  assert.deepEqual(leerPeticion(cab(), "no es json"), { estado: 400 });
  assert.deepEqual(leerPeticion(cab(), '{"e":"x"}'), { estado: 400 });
});
test("como mucho 80 por petición", () => {
  const e = Array.from({ length: 200 }, (_, i) => ["impresion", `e-${i}`]);
  const r = leerPeticion(cab(), JSON.stringify({ e }));
  assert.ok("pares" in r && r.pares.length === 80);
});
