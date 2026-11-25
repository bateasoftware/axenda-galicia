import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { metricasTurso } from "../src/lib/metricas/almacen";
import { ctr, fraseInforme, ranking, semanal, tokenInforme, tokenValido, totales, totalesVacios } from "../src/lib/metricas/informes";
import { esBot, esDestacado, filasDeHits } from "../src/lib/metricas/modelo";
import { evento } from "./ayudas";

const e1 = evento({ slug: "magosto-2026", concello: "Nigrán", organizadores: ["ANPA Panxón", "Concello de Nigrán"], categorias: ["gastronomia", "infantil"] });
const e2 = evento({ slug: "concierto-2026", concello: "Baiona", categorias: ["musica"], destacado_hasta: "2026-12-31" });

describe("filasDeHits", () => {
  test("agrega por evento, organizador, concello, categoría, segmento y total", () => {
    const f = filasDeHits([{ tipo: "vista", evento: e1 }, { tipo: "vista", evento: e1 }, { tipo: "como-llegar", evento: e1 }], "2026-11-25");
    const n = (ambito: string, clave: string, tipo = "vista") => f.find((x) => x.ambito === ambito && x.clave === clave && x.tipo === tipo)?.n;
    assert.equal(n("total", "todo"), 2);
    assert.equal(n("evento", "magosto-2026"), 2);
    assert.equal(n("concello", "nigran"), 2);
    assert.equal(n("organizador", "anpa-panxon"), 2);
    assert.equal(n("organizador", "concello-de-nigran"), 2);
    assert.equal(n("categoria", "infantil"), 2);
    assert.equal(n("segmento", "normal"), 2);
    assert.equal(n("evento", "magosto-2026", "como-llegar"), 1);
  });
  test("el destacado se cuenta aparte mientras dura", () => {
    assert.equal(filasDeHits([{ tipo: "impresion", evento: e2 }], "2026-12-31").find((x) => x.ambito === "segmento")?.clave, "destacado");
    assert.equal(filasDeHits([{ tipo: "impresion", evento: e2 }], "2027-01-01").find((x) => x.ambito === "segmento")?.clave, "normal");
    assert.equal(esDestacado({}, "2026-01-01"), false);
  });
});

test("esBot filtra buscadores, previsualizaciones y herramientas, no navegadores", () => {
  for (const ua of [null, "", "Googlebot/2.1 (+http://www.google.com/bot.html)", "WhatsApp/2.23", "facebookexternalhit/1.1", "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0", "Mozilla/5.0 Chrome-Lighthouse"])
    assert.equal(esBot(ua), true, String(ua));
  assert.equal(esBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), false);
});

describe("informes", () => {
  const filas = [
    ...filasDeHits([{ tipo: "vista", evento: e1 }, { tipo: "vista", evento: e1 }, { tipo: "impresion", evento: e1 }, { tipo: "vista", evento: e2 }], "2026-11-24"),
    ...filasDeHits([{ tipo: "vista", evento: e2 }, { tipo: "vista", evento: e2 }, { tipo: "vista", evento: e2 }], "2026-11-10"),
  ];
  test("totales, ranking y semanas", () => {
    assert.equal(totales(filas).vista, 6);
    assert.deepEqual(ranking(filas, "evento").map((r) => [r.clave, r.t.vista]), [["concierto-2026", 4], ["magosto-2026", 2]]);
    const s = semanal(filas, "2026-11-25", 3);
    assert.deepEqual(s.map((x) => [x.lunes, x.t.vista]), [["2026-11-09", 3], ["2026-11-16", 0], ["2026-11-23", 3]]);
  });
  test("CTR solo con suficientes apariciones", () => {
    assert.equal(ctr({ ...totalesVacios(), impresion: 200, clic: 9 }), 4.5);
    assert.equal(ctr({ ...totalesVacios(), impresion: 10, clic: 5 }), null);
  });
  test("frase en singular", () => {
    assert.equal(
      fraseInforme("Cine", { ...totalesVacios(), impresion: 1, vista: 1, "como-llegar": 1, compartir: 2 }),
      "Tu evento «Cine» apareció 1 vez en la agenda y tuvo 1 visita; 1 persona pidió cómo llegar, 2 lo compartieron.",
    );
  });

  test("frase para el organizador", () => {
    assert.equal(
      fraseInforme("Magosto", { ...totalesVacios(), impresion: 120, vista: 40, "como-llegar": 7 }),
      "Tu evento «Magosto» apareció 120 veces en la agenda y tuvo 40 visitas; 7 pidieron cómo llegar.",
    );
  });
  test("enlace secreto: firma por organizador y depende de la clave", () => {
    const env = { INFORMES_SECRETO: "x".repeat(32) };
    const t = tokenInforme("anpa-panxon", env);
    assert.equal(t.length, 24);
    assert.ok(tokenValido("anpa-panxon", t, env));
    assert.ok(!tokenValido("otro", t, env));
    assert.ok(!tokenValido("anpa-panxon", t, { INFORMES_SECRETO: "y".repeat(32) }));
    assert.ok(!tokenValido("anpa-panxon", t, {}), "sin clave configurada no vale ningún enlace");
  });
});

test("metricasTurso suma contadores y filtra por ámbito (libSQL real en memoria)", async () => {
  const c = createClient({ url: ":memory:" });
  const m = metricasTurso(async () => c);
  const filas = filasDeHits([{ tipo: "vista", evento: e1 }], "2026-11-25");
  await m.registrar(filas);
  await m.registrar(filas);
  const leidas = await m.leer("2026-11-01", { ambito: "evento", clave: "magosto-2026" });
  assert.deepEqual(leidas, [{ dia: "2026-11-25", ambito: "evento", clave: "magosto-2026", tipo: "vista", n: 2 }]);
  assert.equal((await m.leer("2026-12-01")).length, 0);
});
