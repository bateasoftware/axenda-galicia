import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { destinoConfigurado, prepararArchivo } from "../src/lib/recepcion";

describe("destinoConfigurado", () => {
  const IA = { ANTHROPIC_API_KEY: "x" };
  test("sin clave de la IA no hay entrada", () => assert.equal(destinoConfigurado({ SUPABASE_URL: "u", SUPABASE_SERVICE_ROLE_KEY: "k" }), null));
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
