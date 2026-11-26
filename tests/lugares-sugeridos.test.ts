import assert from "node:assert/strict";
import { test } from "node:test";
import { aplicarSugerencias, sugerirLugares, type TablaLugares } from "../src/lib/lugares-sugeridos";

const tabla: TablaLugares = {
  concellos: {},
  lugares: [
    { nombre: "Praza Paradela", concello: "Gondomar", lat: 42.1, lng: -8.7, aprox: true },
    { nombre: "Auditorio", concello: "Nigrán", lat: 42.14, lng: -8.8 },
  ],
};
const l = (nombre: string, lat: number, aprox?: boolean, direccion?: string) => ({ nombre, lat, lng: -8.8, ...(aprox ? { aprox } : {}), ...(direccion ? { direccion } : {}) });

test("sugiere lo nuevo, sin distinguir tildes ni mayúsculas", () => {
  const s = sugerirLugares(
    [
      { concello: "Baiona", lugares: [l("Parque da Ramallosa", 42.1)] },
      { concello: "Baiona", lugares: [l("parque da ramallosa", 42.3), l("Auditorio", 42.2)] },
      { concello: "Nigrán", lugares: [l("AUDITORIO", 42.14)] },
    ],
    tabla,
  );
  assert.equal(s.length, 2);
  assert.deepEqual([s[0].nombre, s[0].usos, s[0].tipo], ["Parque da Ramallosa", 2, "nuevo"]);
  assert.equal(s[0].lat, 42.2, "mediana de las coordenadas");
  // «Auditorio» en Baiona no es el de Nigrán
  assert.equal(s[1].nombre, "Auditorio");
  assert.equal(s[1].concello, "Baiona");
});

test("prefiere las coordenadas exactas a las aproximadas", () => {
  const [s] = sugerirLugares([{ concello: "Baiona", lugares: [l("Muralla", 42.0, true), l("Muralla", 42.118, false, "Rúa Real")] }], tabla);
  assert.equal(s.lat, 42.118);
  assert.equal(s.aprox, false);
  assert.equal(s.direccion, "Rúa Real");
});

test("propone afinar un lugar aproximado cuando algún evento trae coordenadas exactas", () => {
  const [s] = sugerirLugares([{ concello: "Gondomar", lugares: [l("Praza Paradela", 42.1121, false)] }], tabla);
  assert.equal(s.tipo, "afinar");
  const r = aplicarSugerencias(tabla, [s]);
  const p = r.tabla.lugares.find((x) => x.nombre === "Praza Paradela")!;
  assert.equal(p.lat, 42.1121);
  assert.equal(p.aprox, undefined);
  assert.equal(r.afinados, 1);
});

test("no sugiere nada si todo está ya recogido", () => {
  assert.deepEqual(sugerirLugares([{ concello: "Nigrán", lugares: [l("Auditorio", 42.14)] }], tabla), []);
});

test("aplicar: los aproximados solo entran si se usan varias veces, y la tabla queda ordenada", () => {
  const s = sugerirLugares(
    [
      { concello: "Baiona", lugares: [l("Solo una vez", 42, true)] },
      { concello: "Baiona", lugares: [l("Dos veces", 42, true)] },
      { concello: "Baiona", lugares: [l("Dos veces", 42, true)] },
      { concello: "Baiona", lugares: [l("Exacto", 42.1, false)] },
    ],
    tabla,
  );
  const r = aplicarSugerencias(tabla, s);
  assert.deepEqual(
    r.tabla.lugares.map((x) => x.nombre),
    ["Dos veces", "Exacto", "Praza Paradela", "Auditorio"],
  );
  assert.equal(r.anadidos, 2);
  assert.equal(r.tabla.lugares[0].aprox, true);
});
