import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlWidget, leerOpciones, proximos } from "../src/lib/widget";
import { evento } from "./ayudas";

const eventos = [
  evento({ slug: "pasado", sesiones: [{ inicio: "2026-11-01T10:00" }], concello: "Nigrán" }),
  evento({ slug: "nigran", titulo: "Concierto <b>", sesiones: [{ inicio: "2026-11-30T20:00" }], concello: "Nigrán" }),
  evento({ slug: "baiona", sesiones: [{ inicio: "2026-11-29T20:00" }], concello: "Baiona" }),
];
const sitio = { nombre: "Axenda", url: "https://x.test" };

test("opciones con límites", () => {
  assert.deepEqual(leerOpciones(new URLSearchParams("concello=nigran,baiona&n=99&tema=oscuro&id=a<b")), { concellos: ["nigran", "baiona"], n: 20, tema: "oscuro", id: "ab" });
  assert.equal(leerOpciones(new URLSearchParams()).n, 6);
});

test("solo próximos y del concello pedido, en orden", () => {
  assert.deepEqual(proximos(eventos, "2026-11-24T10:00", leerOpciones(new URLSearchParams())).map((e) => e.slug), ["baiona", "nigran"]);
  assert.deepEqual(proximos(eventos, "2026-11-24T10:00", leerOpciones(new URLSearchParams("concello=nigran"))).map((e) => e.slug), ["nigran"]);
});

test("el HTML escapa los títulos y enlaza a la agenda del concello", () => {
  const html = htmlWidget(eventos, leerOpciones(new URLSearchParams("concello=nigran")), sitio, "2026-11-24T10:00");
  assert.ok(html.includes("Concierto &lt;b&gt;"));
  assert.ok(html.includes("https://x.test/concello/nigran?utm_source=widget"));
});
