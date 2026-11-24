import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { destinoConfigurado, prepararArchivo } from "../src/lib/recepcion";
import { extraerSinIA, MARCA_POR_COMPLETAR } from "../src/lib/sin-ia";

describe("destinoConfigurado", () => {
  const IA = { ANTHROPIC_API_KEY: "x" };
  test("sin clave de la IA también se recibe (por completar)", () => assert.equal(destinoConfigurado({ TURSO_DATABASE_URL: "libsql://x" }), "almacen"));
  test("sin IA no se abren PR (no habría datos que revisar)", () => assert.equal(destinoConfigurado({ VERCEL: "1", GITHUB_TOKEN: "t", GITHUB_REPO: "r" }), null));
  test("Supabase manda", () => assert.equal(destinoConfigurado({ ...IA, SUPABASE_URL: "u", SUPABASE_SERVICE_ROLE_KEY: "k", GITHUB_TOKEN: "t", GITHUB_REPO: "r" }), "almacen"));
  test("en Vercel sin Supabase: PR en GitHub", () => assert.equal(destinoConfigurado({ ...IA, VERCEL: "1", GITHUB_TOKEN: "t", GITHUB_REPO: "r" }), "github"));
  test("en Vercel sin nada: no hay destino", () => assert.equal(destinoConfigurado({ ...IA, VERCEL: "1" }), null));
  test("en local sin nada: ficheros", () => assert.equal(destinoConfigurado(IA), "almacen"));
});

test("prepararArchivo deja los PDF tal cual", async () => {
  const pdf = Buffer.from("%PDF-1.7\n...");
  const { archivo, hash } = await prepararArchivo(pdf);
  assert.equal(archivo.tipo, "application/pdf");
  assert.equal(archivo.datos, pdf);
  assert.equal(hash.length, 16);
});

test("sin IA: un pendiente por completar con el título del formulario y el texto en lo no publicable", async () => {
  const r = await extraerSinIA({ recibido: "2026-11-24T10:00", nota: "Qué: Magosto de Panxón\nCuándo: sábado 17:00\nOrganiza: ANPA" });
  assert.ok(r.tipo === "ok");
  const [e] = r.eventos;
  assert.equal(e.titulo, "Magosto de Panxón");
  assert.equal(e.slug, "magosto-de-panxon");
  assert.deepEqual(e.organizadores, ["ANPA"]);
  assert.equal(e.inferido![0], MARCA_POR_COMPLETAR);
  assert.ok(e.inferido!.some((x) => x.includes("sábado 17:00")));
  assert.equal(e.resumen, "", "nada del texto recibido va a campos publicables");
});
