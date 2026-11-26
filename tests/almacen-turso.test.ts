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

  test("sin Vercel Blob, el cartel se guarda en la base de datos y se sirve en /cartel/<id>", async () => {
    const cliente = createClient({ url: ":memory:" });
    const a = almacenTurso({ cliente: async () => cliente });
    const p = await a.crear({ evento: evento(), cartel: { datos: Buffer.from([7, 8, 9]), tipo: "image/jpeg" } });
    assert.equal(p.cartel, `/cartel/${p.id}.jpg`);
    const c = await a.cartel(p.id);
    assert.equal(c?.tipo, "image/jpeg");
    assert.deepEqual([...c!.datos], [7, 8, 9]);
    const r = await a.publicar(p.id, evento());
    assert.equal((await a.publicados()).find((e) => e.slug === r.slug)?.cartel, `/cartel/${p.id}.jpg`, "válido según el esquema");
    // Al descartar, el cartel se borra
    const p2 = await a.crear({ evento: evento(), cartel: { datos: Buffer.from([1]), tipo: "image/jpeg" } });
    await a.descartar(p2.id);
    assert.equal(await a.cartel(p2.id), null);
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

  test("añadir o cambiar el cartel de un pendiente y de un publicado (id nuevo, el anterior se borra)", async () => {
    const cliente = createClient({ url: ":memory:" });
    const a = almacenTurso({ cliente: async () => cliente }); // sin Blob: el cartel va en la tabla carteles
    const p = await a.crear({ evento: evento() }); // sin cartel
    assert.equal(p.cartel, undefined);
    const url1 = await a.ponerCartel(p.id, { datos: Buffer.from([1]), tipo: "image/jpeg" }, "pendiente");
    assert.match(url1, /^\/cartel\/[0-9a-f-]{36}\.jpg$/);
    assert.equal((await a.pendiente(p.id))?.cartel, url1);
    const url2 = await a.ponerCartel(p.id, { datos: Buffer.from([2]), tipo: "image/jpeg" }, "pendiente");
    assert.notEqual(url1, url2, "URL nueva: no se queda el cartel antiguo en la caché");
    assert.equal((await cliente.execute("SELECT COUNT(*) n FROM carteles")).rows[0].n, 1, "el anterior se borró");

    const r = await a.publicar(p.id, evento());
    assert.equal((await a.publicado(p.id))?.evento.cartel, url2);
    const url3 = await a.ponerCartel(p.id, { datos: Buffer.from([3]), tipo: "image/png" }, "publicado");
    assert.match(url3, /\.png$/);
    assert.equal((await a.publicado(p.id))?.evento.cartel, url3, "el evento publicado apunta al cartel nuevo");
    assert.equal(r.slug, "prueba-2026");
  });

  test("ver, editar y retirar publicados; el slug no cambia", async () => {
    const { a } = nuevo();
    const p = await a.crear({ evento: evento() });
    await a.publicar(p.id, evento());
    const lista = await a.publicadosConId();
    assert.deepEqual(lista.map((x) => x.id), [p.id]);
    await a.guardarPublicado(p.id, { ...lista[0].evento, titulo: "Título nuevo" });
    assert.equal((await a.publicado(p.id))?.evento.titulo, "Título nuevo");
    assert.equal((await a.publicados())[0].titulo, "Título nuevo");

    await a.retirar(p.id);
    assert.equal(await a.publicado(p.id), null);
    assert.equal((await a.publicados()).length, 0);
    assert.deepEqual(await a.slugsRetirados(), ["prueba-2026"], "oculta también uno de data/eventos con ese slug");
    assert.deepEqual((await a.cobertura()).map((c) => c.estado), ["descartado"]);
  });

  test("un evento de data/eventos se edita copiándolo a la base de datos y se oculta con retirarSlug", async () => {
    const { a } = nuevo();
    const delRepo = evento({ slug: "del-repo-2026", cartel: "/carteles/del-repo-2026.jpg" });
    const { id } = await a.adoptar({ ...delRepo, titulo: "Editado" });
    assert.equal((await a.publicado(id))?.evento.cartel, "/carteles/del-repo-2026.jpg");
    assert.equal((await a.publicados())[0].titulo, "Editado");
    await a.retirarSlug("otro-del-repo");
    assert.deepEqual(await a.slugsRetirados(), ["otro-del-repo"]);
    // Las marcas de "oculto" no cuentan como eventos en la cobertura
    assert.deepEqual((await a.cobertura()).map((c) => c.estado), ["publicado"]);
    // Y un pendiente descartado normal NO oculta nada
    const p = await a.crear({ evento: evento({ slug: "pendiente-normal" }) });
    await a.descartar(p.id);
    assert.deepEqual(await a.slugsRetirados(), ["otro-del-repo"]);
  });
});

describe("lugares habituales", () => {
  test("crear, editar, renombrar y borrar", async () => {
    const a = almacenTurso({ cliente: async () => createClient({ url: ":memory:" }) });
    assert.deepEqual(await a.lugares(), []);
    await a.guardarLugar({ nombre: "Praza Paradela", concello: "Gondomar", lat: 42.1115, lng: -8.7608, aprox: true });
    await a.guardarLugar({ nombre: "Auditorio", concello: "Nigrán", lat: 42.14, lng: -8.8, direccion: "Rúa X", parroquia: "Nigrán" });
    // La misma clave (sin tildes ni mayúsculas) actualiza en vez de duplicar
    await a.guardarLugar({ nombre: "PRAZA PARADELA", concello: "gondomar", lat: 42.1116, lng: -8.7609 });
    let todos = await a.lugares();
    assert.equal(todos.length, 2);
    const praza = todos.find((l) => l.concello === "gondomar")!;
    assert.deepEqual([praza.lat, praza.aprox], [42.1116, undefined]);
    // Renombrar sustituye el anterior
    await a.guardarLugar({ nombre: "Auditorio Municipal", concello: "Nigrán", lat: 42.14, lng: -8.8 }, { nombre: "Auditorio", concello: "Nigrán" });
    todos = await a.lugares();
    assert.deepEqual(todos.map((l) => l.nombre).sort(), ["Auditorio Municipal", "PRAZA PARADELA"]);
    await a.borrarLugar("auditorio municipal", "Nigrán");
    assert.equal((await a.lugares()).length, 1);
  });
});

describe("cambiar un lugar actualiza los eventos que lo usan", () => {
  test("aplicarLugar: mismo nombre (sin tildes) y concello; renombrar; otro concello no", async () => {
    const { aplicarLugar } = await import("../src/lib/lugares-propagar");
    const e = evento({ concello: "Gondomar", lugares: [{ nombre: "praza paradela", lat: 42.1, lng: -8.7, aprox: true }, { nombre: "Otro", lat: 42.2, lng: -8.7 }] });
    const nuevo = aplicarLugar(e, { nombre: "Praza Paradela", concello: "Gondomar", lat: 42.1081, lng: -8.7599, direccion: "Rúa A" })!;
    assert.deepEqual(nuevo.lugares[0], { nombre: "Praza Paradela", lat: 42.1081, lng: -8.7599, direccion: "Rúa A" });
    assert.deepEqual(nuevo.lugares[1], e.lugares[1]);
    assert.equal(aplicarLugar(nuevo, { nombre: "Praza Paradela", concello: "Gondomar", lat: 42.1081, lng: -8.7599, direccion: "Rúa A" }), null, "ya igual");
    assert.equal(aplicarLugar(e, { nombre: "Praza Paradela", concello: "Nigrán", lat: 42.14, lng: -8.8 }), null, "otro concello");
    const renombrado = aplicarLugar(e, { nombre: "Praza de Paradela", concello: "Gondomar", lat: 42.1, lng: -8.76 }, { nombre: "Praza Paradela", concello: "Gondomar" })!;
    assert.equal(renombrado.lugares[0].nombre, "Praza de Paradela");
  });
  test("propagarLugar: publicados y pendientes en Turso", async () => {
    const { propagarLugar } = await import("../src/lib/lugares-propagar");
    const a = almacenTurso({ cliente: async () => createClient({ url: ":memory:" }) });
    const usa = { concello: "Baiona", lugares: [{ nombre: "Local de prueba XYZ", lat: 42.11, lng: -8.84, aprox: true }] };
    const p1 = await a.crear({ evento: evento({ slug: "uno", ...usa }) });
    await a.publicar(p1.id, evento({ slug: "uno", ...usa }));
    await a.crear({ evento: evento({ slug: "dos", ...usa }) });
    await a.crear({ evento: evento({ slug: "tres" }) });
    // Uno de data/eventos que también lo usa: pasa a la base de datos con el cambio
    const repo = [evento({ slug: "del-repo", ...usa }), evento({ slug: "otro-repo" })];
    const r = await propagarLugar(a, { nombre: "Local de prueba XYZ", concello: "Baiona", lat: 42.1234, lng: -8.8456 }, undefined, repo);
    assert.deepEqual(r, { publicados: 2, pendientes: 1 });
    const pubs = await a.publicados();
    assert.deepEqual(pubs.map((e) => e.slug).sort(), ["del-repo", "uno"]);
    assert.deepEqual([pubs[0].lugares[0].lat, pubs[0].lugares[0].aprox], [42.1234, undefined]);
    const pend = (await a.pendientes()).find((p) => p.evento.slug === "dos")!;
    assert.equal(pend.evento.lugares[0].lng, -8.8456);
  });
});
