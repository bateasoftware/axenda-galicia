// Comprobaciones del formulario público que no llegan a llamar a la IA
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/enviar/route";

let anterior: string | undefined;
before(() => {
  anterior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "x";
});
after(() => {
  if (anterior === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = anterior;
});

const peticion = (campos: Record<string, string>, ip = "1.1.1.1") => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return new Request("http://localhost/api/enviar", { method: "POST", body: f, headers: { "x-forwarded-for": ip } });
};

test("sin permiso, 400", async () => assert.equal((await POST(peticion({ que: "a", cuando: "b", donde: "c" }))).status, 400));
test("sin cartel ni datos mínimos, 400", async () => assert.equal((await POST(peticion({ permiso: "si", que: "Magosto" }))).status, 400));
test("email mal escrito, 400", async () => assert.equal((await POST(peticion({ permiso: "si", que: "a", cuando: "b", donde: "c", email: "no" }))).status, 400));
test("el campo trampa engaña al bot sin guardar nada", async () => {
  const r = await POST(peticion({ web: "http://spam", permiso: "si" }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { estado: "creado", eventos: [] });
});
test("límite de envíos por IP", async () => {
  let ultimo = 0;
  for (let i = 0; i < 10; i++) ultimo = (await POST(peticion({ permiso: "no" }, "9.9.9.9"))).status;
  assert.equal(ultimo, 429);
});
