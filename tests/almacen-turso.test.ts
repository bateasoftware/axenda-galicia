// El almacén de Turso contra una base libSQL real en memoria (el mismo SQL que en Turso)
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { almacenTurso, type SubirCartel } from "../src/lib/almacen/turso";
import { evento } from "./ayudas";

function nuevo() {
  const subidos: string[] = [];
  const subirCartel: SubirCartel = async (ruta) => {
    subidos.push(ruta);
    return `https://abc123.public.blob.vercel-storage.com/${ruta.replace(".jpg", "-x1y2.jpg")}`;
  };
  const cliente = createClient({ url: ":memory:" });
  return { a: almacenTurso({ cliente: async () => cliente, subirCartel }), subidos, cliente };
}

describe("almacenTurso", () => {
  test("crea las tablas solo, guarda el pendiente con cartel y el contacto aparte", async () => {
    const { a, subidos, cliente } = nuevo();
    const p = await a.crear({
      evento: evento({ slug: "Magosto 2026" }),
      cartel: { datos: Buffer.from("jpg"), tipo: "image/jpeg" },
      hash: "h1",
      contacto: { canal: "whatsapp", valor: "34600000000" },
      duplicados: ["evento:otro"],
    });
    assert.equal(p.evento.slug, "magosto-2026");
    assert.match(p.cartel!, /^https:\/\/abc123\.public\.blob\.vercel-storage\.com\/carteles\//);
    assert.equal(subidos.length, 1);
    const leido = await a.pendiente(p.id);
    assert.equal(leido?.contacto?.valor, "34600000000");
    assert.deepEqual(leido?.duplicados, ["evento:otro"]);
    // El teléfono no está en la fila del evento
    const fila = (await cliente.execute("SELECT datos FROM eventos")).rows[0];
    assert.ok(!String(fila.datos).includes("34600000000"));
  });

  test("yaVisto por hash y por fuente + uid (columnas generadas desde el JSON)", async () => {
    const { a } = nuevo();
    await a.crear({ evento: evento({ fuente: { canal: "ics", recibido: "2026-11-24T08:00", id_fuente: "cultura-gal", uid: "u@1" } }), hash: "h2" });
    assert.equal(await a.yaVisto({ hash: "h2" }), true);
    assert.equal(await a.yaVisto({ id_fuente: "cultura-gal", uid: "u@1" }), true);
    assert.equal(await a.yaVisto({ id_fuente: "cultura-gal", uid: "u@2" }), false);
  });

  test("guardar, publicar (slug libre y cartel de Blob), olvidar contacto y descartar", async () => {
    const { a } = nuevo();
    const p1 = await a.crear({ evento: evento(), cartel: { datos: Buffer.from("x"), tipo: "image/jpeg" }, contacto: { canal: "email", valor: "a@b.es" } });
    const p2 = await a.crear({ evento: evento() });
    await a.guardar(p1.id, { ...p1.evento, titulo: "Cambiado" });
    assert.equal((await a.pendiente(p1.id))?.evento.titulo, "Cambiado");

    const r1 = await a.publicar(p1.id, evento({ titulo: "Cambiado" }));
    assert.equal(r1.slug, "prueba-2026");
    assert.equal(r1.contacto?.valor, "a@b.es");
    await a.olvidarContacto(p1.id);
    const r2 = await a.publicar(p2.id, evento());
    assert.equal(r2.slug, "prueba-2026-2", "el slug publicado no se repite");

    const publicados = await a.publicados();
    assert.equal(publicados.length, 2);
    assert.match(publicados.find((e) => e.slug === "prueba-2026")!.cartel!, /vercel-storage\.com\/carteles\//);
    assert.equal((await a.pendientes()).length, 0);

    const p3 = await a.crear({ evento: evento(), contacto: { canal: "whatsapp", valor: "1" } });
    await a.descartar(p3.id);
    assert.equal(await a.pendiente(p3.id), null);
    const { contactos } = await a.exportar();
    assert.equal(contactos.length, 0, "no queda ningún contacto guardado");
    assert.deepEqual(
      (await a.cobertura()).map((c) => c.estado).sort(),
      ["descartado", "publicado", "publicado"],
    );
  });

  test("marcarDuplicados y exportar para migrar", async () => {
    const { a } = nuevo();
    const p = await a.crear({ evento: evento() });
    await a.marcarDuplicados(p.id, ["pendiente:x"]);
    const { eventos } = await a.exportar();
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].duplicados, '["pendiente:x"]');
    assert.equal(JSON.parse(eventos[0].datos).slug, "prueba-2026");
  });
});
