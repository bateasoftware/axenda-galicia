// Comprobaciones del endpoint que no llegan a llamar a GitHub ni a la IA
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/entrada/route";

const SECRETO = "secreto-de-prueba";
const VARIABLES = { ENTRADA_SECRETO: SECRETO, GITHUB_TOKEN: "x", GITHUB_REPO: "x/y", ANTHROPIC_API_KEY: "x" };
const anteriores: Record<string, string | undefined> = {};

before(() => {
  for (const [k, v] of Object.entries(VARIABLES)) {
    anteriores[k] = process.env[k];
    process.env[k] = v;
  }
});
after(() => {
  for (const [k, v] of Object.entries(anteriores)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function peticion({ clave = SECRETO, imagen, canal }: { clave?: string | null; imagen?: Blob; canal?: string } = {}) {
  const datos = new FormData();
  if (imagen) datos.set("imagen", imagen, "cartel.jpg");
  if (canal) datos.set("canal", canal);
  return new Request("http://localhost/api/entrada", {
    method: "POST",
    headers: clave ? { Authorization: `Bearer ${clave}` } : {},
    body: datos,
  });
}

describe("POST /api/entrada", () => {
  test("503 si falta configuración", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    try {
      assert.equal((await POST(peticion())).status, 503);
    } finally {
      process.env.ANTHROPIC_API_KEY = "x";
    }
  });

  test("401 sin clave o con clave incorrecta", async () => {
    assert.equal((await POST(peticion({ clave: null }))).status, 401);
    assert.equal((await POST(peticion({ clave: "otra" }))).status, 401);
  });

  test("400 sin imagen o con canal desconocido", async () => {
    assert.equal((await POST(peticion())).status, 400);
    assert.equal((await POST(peticion({ imagen: new Blob(["x"]), canal: "fax" }))).status, 400);
  });

  test("413 si la imagen pasa de 4 MB", async () => {
    assert.equal((await POST(peticion({ imagen: new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]) }))).status, 413);
  });

  test("415 si el fichero no es una imagen ni un PDF", async () => {
    const r = await POST(peticion({ imagen: new Blob(["no soy una imagen"]) }));
    assert.equal(r.status, 415);
  });
});
