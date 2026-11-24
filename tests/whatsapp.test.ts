import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { firmaValida, mensajesDelAviso } from "../src/lib/whatsapp";
import { GET, POST } from "../src/app/api/whatsapp/route";

const SECRETO = "secreto-app";
const VARIABLES = { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_APP_SECRET: SECRETO, WHATSAPP_VERIFY_TOKEN: "verifica" };
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

const firmar = (cuerpo: string) => `sha256=${createHmac("sha256", SECRETO).update(cuerpo).digest("hex")}`;

const aviso = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            messages: [
              { id: "m1", from: "34600000000", timestamp: "1795500000", type: "image", image: { id: "media1", caption: "Sábado en Panxón" } },
              { id: "m2", from: "34600000000", timestamp: "1795500001", type: "document", document: { id: "media2", mime_type: "application/pdf", filename: "nadal.pdf" } },
              { id: "m3", from: "34600000000", timestamp: "1795500002", type: "text", text: { body: "hola" } },
              { id: "m4", from: "34600000000", timestamp: "1795500003", type: "sticker" },
            ],
            statuses: [{ id: "x", status: "read" }],
          },
        },
      ],
    },
  ],
};

describe("WhatsApp", () => {
  test("firma HMAC del cuerpo", () => {
    assert.ok(firmaValida("{}", firmar("{}"), SECRETO));
    assert.ok(!firmaValida("{}", firmar("{ }"), SECRETO));
    assert.ok(!firmaValida("{}", null, SECRETO));
  });

  test("mensajesDelAviso simplifica imagen, documento, texto y lo demás", () => {
    const m = mensajesDelAviso(aviso);
    assert.deepEqual(
      m.map((x) => x.tipo),
      ["imagen", "documento", "texto", "otro"],
    );
    assert.equal(m[0].tipo === "imagen" && m[0].texto, "Sábado en Panxón");
    assert.deepEqual(mensajesDelAviso({ object: "page" }), []);
  });

  test("GET verifica el webhook solo con el token correcto", async () => {
    const ok = await GET(new Request("http://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=42"));
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "42");
    assert.equal((await GET(new Request("http://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=42"))).status, 403);
  });

  test("POST rechaza avisos sin firma válida", async () => {
    const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    assert.equal((await POST(new Request("http://x/api/whatsapp", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": "sha256=00" } }))).status, 401);
    assert.equal((await POST(new Request("http://x/api/whatsapp", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firmar(cuerpo) } }))).status, 200);
  });
});
