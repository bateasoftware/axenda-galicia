import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fuentesPorRevisar, leerFuentes, proximaRevision, urlDelMes, type Fuente } from "../src/lib/fuentes";

const base: Fuente = {
  id: "x",
  nombre: "X",
  tipo: "oficial",
  concello: "Nigrán",
  url: "https://example.org",
  metodo: "revision-manual",
  activa: false,
  frecuencia: "semanal",
  ultima_revision: "2026-11-17",
  estado: "verificada",
};

describe("fuentes", () => {
  test("data/fuentes.json es válido", () => assert.ok(leerFuentes().length > 10));

  test("próxima revisión según la frecuencia", () => {
    assert.equal(proximaRevision(base), "2026-11-24");
    assert.equal(proximaRevision({ ...base, frecuencia: "mensual", ultima_revision: "2026-02-01" }), "2026-03-03");
    assert.equal(proximaRevision({ ...base, ultima_revision: null }), null);
  });

  test("toca revisar las atrasadas y las nunca revisadas, no las de envío directo", () => {
    const fuentes: Fuente[] = [
      { ...base, id: "al-dia", ultima_revision: "2026-11-20" },
      { ...base, id: "toca-hoy" },
      { ...base, id: "nunca", ultima_revision: null },
      { ...base, id: "atrasada", ultima_revision: "2026-11-01" },
      { ...base, id: "directa", metodo: "envio-directo", ultima_revision: null },
    ];
    assert.deepEqual(
      fuentesPorRevisar(fuentes, "2026-11-24").map((f) => [f.id, f.retraso]),
      [["nunca", null], ["atrasada", 16], ["toca-hoy", 0]],
    );
  });

  test("URL del boletín del mes", () =>
    assert.equal(urlDelMes("https://x/{MES}_{AÑO}_Vigo.pdf", 2026, 6), "https://x/XUNO_2026_Vigo.pdf"));
});
