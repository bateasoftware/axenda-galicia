import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { abiertoEntre, colocarLarga, diasEntre, esLargaDuracion, repartirLargas } from "../src/lib/larga-duracion";
import { evento } from "./ayudas";

const expo = (inicio: string, fin: string, slug = "expo") => evento({ slug, sesiones: [{ inicio, fin }] });

describe("eventos de larga duración", () => {
  test("días entre fechas (cambio de mes y de año)", () => {
    assert.equal(diasEntre("2026-11-28", "2026-12-05"), 7);
    assert.equal(diasEntre("2026-12-31", "2027-01-01"), 1);
  });
  test("una semana o más es larga; un fin de semana o varias sesiones sueltas, no", () => {
    assert.equal(esLargaDuracion(expo("2026-02-01", "2026-12-20")), true);
    assert.equal(esLargaDuracion(expo("2026-12-01", "2026-12-08")), true);
    assert.equal(esLargaDuracion(expo("2026-12-05", "2026-12-07")), false);
    const ciclo = evento({ sesiones: [{ inicio: "2026-10-01T20:00" }, { inicio: "2026-11-01T20:00" }, { inicio: "2026-12-01T20:00" }] });
    assert.equal(esLargaDuracion(ciclo), false);
  });
  test("una persona puede fijarlo en los dos sentidos", () => {
    assert.equal(esLargaDuracion({ ...expo("2026-12-05", "2026-12-06"), larga_duracion: true }), true);
    assert.equal(esLargaDuracion({ ...expo("2026-02-01", "2026-12-20"), larga_duracion: false }), false);
  });

  const hoy = "2026-11-26";
  test("sale el día que abre", () => {
    assert.deepEqual(colocarLarga(expo("2026-12-03", "2027-02-01"), hoy, hoy, null), { dia: "2026-12-03", momento: "inaugura" });
  });
  test("en su última semana sale el día que cierra; el mismo día, «Último día»", () => {
    assert.deepEqual(colocarLarga(expo("2026-02-01", "2026-12-01"), hoy, hoy, null), { dia: "2026-12-01", momento: "ultimos-dias" });
    assert.deepEqual(colocarLarga(expo("2026-02-01", hoy), hoy, hoy, null), { dia: hoy, momento: "ultimo-dia" });
  });
  test("a mitad de su recorrido no sale en ningún día", () => {
    assert.equal(colocarLarga(expo("2026-02-01", "2026-12-20"), hoy, hoy, null), null);
  });
  test("con un rango (el finde) solo cuenta si abre o cierra dentro", () => {
    const [v, d] = ["2026-11-27", "2026-11-29"];
    assert.deepEqual(colocarLarga(expo("2026-11-28", "2027-01-10"), hoy, v, d)?.momento, "inaugura");
    assert.deepEqual(colocarLarga(expo("2026-01-01", "2026-11-29"), hoy, v, d)?.dia, "2026-11-29");
    assert.equal(colocarLarga(expo("2026-01-01", "2026-12-02"), hoy, v, d), null, "cierra después del finde");
    assert.equal(abiertoEntre(expo("2026-01-01", "2026-12-02"), v, d), true);
  });
  test("abiertas (las que cierran antes, primero) y próximas; las pasadas no", () => {
    const r = repartirLargas(
      [expo("2026-01-01", "2026-12-31", "a"), expo("2026-03-01", "2026-12-01", "b"), expo("2026-12-10", "2027-01-31", "c"), expo("2026-01-01", "2026-11-01", "pasada"), evento({ slug: "normal" })],
      hoy,
    );
    assert.deepEqual(r.abiertas.map((e) => e.slug), ["b", "a"]);
    assert.deepEqual(r.proximas.map((e) => e.slug), ["c"]);
  });
});
