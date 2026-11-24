// Comprueba las peticiones a la API REST de Supabase con un fetch falso
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { almacenSupabase } from "../src/lib/almacen";
import { evento } from "./ayudas";

type Llamada = { metodo: string; url: string; cuerpo?: unknown; cabeceras: Record<string, string> };

async function conFetch(respuestas: (l: Llamada) => unknown, fn: (llamadas: Llamada[]) => Promise<void>) {
  const llamadas: Llamada[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const l: Llamada = {
      metodo: init.method ?? "GET",
      url: String(url),
      cuerpo: typeof init.body === "string" ? JSON.parse(init.body) : init.body ? "<binario>" : undefined,
      cabeceras: init.headers as Record<string, string>,
    };
    llamadas.push(l);
    return new Response(JSON.stringify(respuestas(l) ?? []), { status: 200 });
  }) as typeof fetch;
  try {
    await fn(llamadas);
  } finally {
    globalThis.fetch = original;
  }
}

const URL_SB = "https://abc.supabase.co";
const ID = "11111111-2222-3333-4444-555555555555";
const fila = { id: ID, slug: "prueba-2026", estado: "pendiente", datos: evento(), hash: "h", cartel_path: null, duplicados: [], creado: "2026-11-24T10:00:00Z" };

describe("almacenSupabase", () => {
  const a = almacenSupabase({ url: URL_SB, clave: "clave-servicio" });

  test("crear: fila, cartel en Storage y contacto aparte", () =>
    conFetch(
      (l) => (l.url.includes("/rest/v1/eventos?select") ? [fila] : []),
      async (llamadas) => {
        const p = await a.crear({ evento: evento(), cartel: { datos: Buffer.from("jpg"), tipo: "image/jpeg" }, hash: "h", contacto: { canal: "whatsapp", valor: "34600000000" } });
        assert.equal(p.cartel, `${URL_SB}/storage/v1/object/public/carteles/${ID}.jpg`);
        const [insertar, subir, enlazar, contacto] = llamadas;
        assert.equal(insertar.metodo, "POST");
        assert.equal(insertar.cabeceras.apikey, "clave-servicio");
        assert.ok(!JSON.stringify(insertar.cuerpo).includes("34600000000"), "el evento no lleva el teléfono");
        assert.equal(subir.url, `${URL_SB}/storage/v1/object/carteles/${ID}.jpg`);
        assert.equal(enlazar.metodo, "PATCH");
        assert.deepEqual(contacto.cuerpo, { evento_id: ID, canal: "whatsapp", valor: "34600000000" });
      },
    ));

  test("yaVisto codifica los valores en la URL", () =>
    conFetch(
      () => [],
      async (llamadas) => {
        assert.equal(await a.yaVisto({ id_fuente: "cultura-gal", uid: "calendar.1@www.cultura.gal" }), false);
        assert.ok(llamadas[0].url.endsWith("eventos?id_fuente=eq.cultura-gal&uid=eq.calendar.1%40www.cultura.gal&select=id&limit=1"));
      },
    ));

  test("publicar: slug libre, cartel con URL pública y devuelve el contacto", () =>
    conFetch(
      (l) =>
        l.url.includes("contactos?evento_id") ? [{ canal: "whatsapp", valor: "34600000000" }]
        : l.url.includes(`eventos?id=eq.${ID}&select`) ? [{ ...fila, cartel_path: `${ID}.jpg` }]
        : l.url.includes("estado=eq.publicado") ? [{ slug: "prueba-2026" }]
        : [],
      async (llamadas) => {
        const r = await a.publicar(ID, evento());
        assert.equal(r.slug, "prueba-2026-2");
        assert.equal(r.contacto?.valor, "34600000000");
        const patch = llamadas.find((l) => l.metodo === "PATCH")!;
        const cuerpo = patch.cuerpo as { estado: string; datos: { cartel: string; slug: string } };
        assert.equal(cuerpo.estado, "publicado");
        assert.equal(cuerpo.datos.slug, "prueba-2026-2");
        assert.equal(cuerpo.datos.cartel, `${URL_SB}/storage/v1/object/public/carteles/${ID}.jpg`);
      },
    ));

  test("publicados omite los que no son válidos", () =>
    conFetch(
      () => [{ datos: evento() }, { datos: { slug: "roto" } }],
      async () => assert.equal((await a.publicados()).length, 1),
    ));
});
