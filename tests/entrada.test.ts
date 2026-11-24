import { describe, test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { almacenLocal } from "../src/lib/almacen";
import { cuerpoPR, ETIQUETA, limpiarSlug, procesarEntrada, procesarEntradaGitHub, slugLibre, type Entrada } from "../src/lib/entrada";
import type { ResultadoExtraccion } from "../src/lib/extraccion";
import type { ClienteGitHub, PR } from "../src/lib/github";
import { normalizarCartel } from "../src/lib/imagen";
import { evento } from "./ayudas";
import type { Evento } from "../src/lib/tipos";

/** GitHub en memoria: registra lo que se hace */
function githubFalso({ ficheros = [] as string[], ramas = [] as string[], prs = [] as PR[] } = {}) {
  const registro = { subidos: new Map<string, Buffer>(), comentarios: [] as string[], etiquetas: [] as string[], creados: [] as { titulo: string; cuerpo: string; rama: string }[] };
  const gh: ClienteGitHub = {
    existeFichero: async (r) => ficheros.includes(r),
    existeRama: async (r) => ramas.includes(r),
    crearRama: async (r) => void ramas.push(r),
    subirFichero: async (_rama, r, c) => void registro.subidos.set(r, c),
    crearPR: async (d) => {
      registro.creados.push(d);
      return { numero: 7, url: "https://github.com/x/y/pull/7", estado: "open", fusionado: false, cuerpo: d.cuerpo };
    },
    etiquetar: async (_n, e) => void registro.etiquetas.push(...e),
    comentar: async (_n, t) => void registro.comentarios.push(t),
    prsConEtiqueta: async () => prs,
  };
  return { gh, registro };
}

// Lo que devuelve la IA: el evento sin fuente ni cartel
const extraido: Omit<Evento, "fuente" | "cartel"> & Partial<Evento> = evento({ inferido: ["año"] });
delete extraido.fuente;
delete extraido.cartel;
const extraccionOk = async (): Promise<ResultadoExtraccion> => ({ tipo: "ok", eventos: [{ ...extraido, slug: "Magosto Gondomar 2026" }] });
const programa = async (): Promise<ResultadoExtraccion> => ({
  tipo: "ok",
  eventos: [
    { ...extraido, slug: "acendido-2026", titulo: "Acendido" },
    { ...extraido, slug: "cabalgata-2026", titulo: "Cabalgata", sesiones: [{ inicio: "2027-01-05T18:00" }] },
  ],
});

const entrada: Entrada = {
  archivo: { datos: Buffer.from("jpeg"), tipo: "image/jpeg" },
  hash: "abc123",
  canal: "email",
  recibido: "2026-11-19T09:52",
  nota: "Tel. 600 000 000",
};

describe("limpiarSlug", () => {
  test("pasa a kebab-case sin tildes", () => assert.equal(limpiarSlug("Magosto en Panxón, 2026!", "2026-11-19T09:52"), "magosto-en-panxon-2026"));
  test("si queda vacío usa la fecha", () => assert.equal(limpiarSlug("¿?", "2026-11-19T09:52"), "evento-2026-11-19"));
});

describe("slugLibre", () => {
  test("salta los slugs publicados o en revisión", async () => {
    const { gh } = githubFalso({ ficheros: ["data/eventos/a-2026.json"], ramas: ["eventos/a-2026-2"] });
    assert.equal(await slugLibre(gh, "a-2026"), "a-2026-3");
  });
});

describe("procesarEntradaGitHub", () => {
  test("crea rama, sube cartel y JSON, y abre el PR etiquetado", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntradaGitHub(entrada, { github: gh, extraer: extraccionOk });
    assert.equal(r.estado, "creado");
    assert.deepEqual([...registro.subidos.keys()], ["public/carteles/magosto-gondomar-2026.jpg", "data/eventos/magosto-gondomar-2026.json"]);
    const json = JSON.parse(registro.subidos.get("data/eventos/magosto-gondomar-2026.json")!.toString());
    assert.equal(json.cartel, "/carteles/magosto-gondomar-2026.jpg");
    assert.deepEqual(json.fuente, { canal: "email", recibido: "2026-11-19T09:52" });
    assert.equal(registro.creados[0].rama, "eventos/magosto-gondomar-2026");
    assert.ok(registro.etiquetas.includes(ETIQUETA));
    assert.ok(registro.etiquetas.includes("revisar-datos"), "tiene datos deducidos");
  });

  test("el PR no incluye el texto ni los datos de quien envía", async () => {
    const { gh, registro } = githubFalso();
    await procesarEntradaGitHub(entrada, { github: gh, extraer: extraccionOk });
    assert.ok(!registro.creados[0].cuerpo.includes("600 000 000"));
    assert.ok(registro.creados[0].cuerpo.includes("<!-- axenda:hash=abc123 -->"));
  });

  test("un cartel repetido no abre otro PR: comenta en el abierto", async () => {
    const previo: PR = { numero: 3, url: "https://github.com/x/y/pull/3", estado: "open", fusionado: false, cuerpo: "…<!-- axenda:hash=abc123 -->" };
    const { gh, registro } = githubFalso({ prs: [previo] });
    let llamadas = 0;
    const r = await procesarEntradaGitHub(entrada, { github: gh, extraer: async () => (llamadas++, extraccionOk()) });
    assert.deepEqual(r, { estado: "duplicado", pr: previo.url });
    assert.equal(llamadas, 0, "no gasta una llamada a la IA");
    assert.equal(registro.comentarios.length, 1);
    assert.equal(registro.creados.length, 0);
  });

  test("si el modelo lo rechaza, no toca GitHub", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntradaGitHub(entrada, { github: gh, extraer: async () => ({ tipo: "rechazado", categoria: "general_harms" }) });
    assert.equal(r.estado, "rechazado");
    assert.equal(registro.subidos.size, 0);
  });

  test("con errores de validación abre el PR igualmente, marcado para corregir", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntradaGitHub(entrada, {
      github: gh,
      extraer: async () => ({ tipo: "ok", eventos: [{ ...extraido, slug: "x-2026", categorias: [], sesiones: [{ inicio: "22/11" }] }] }),
    });
    assert.equal(r.estado, "creado");
    assert.ok(r.estado === "creado" && r.eventos[0].errores.length >= 2);
    assert.match(registro.creados[0].titulo, /^⚠️/);
    assert.match(registro.creados[0].cuerpo, /Hay que corregir/);
  });
});

describe("procesarEntradaGitHub con un programa", () => {
  test("un PR con un JSON y un cartel por acto", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntradaGitHub(entrada, { github: gh, extraer: programa });
    assert.ok(r.estado === "creado" && r.eventos.length === 2);
    assert.equal(registro.creados.length, 1);
    assert.match(registro.creados[0].titulo, /^2 eventos/);
    assert.deepEqual([...registro.subidos.keys()].filter((k) => k.endsWith(".json")), ["data/eventos/acendido-2026.json", "data/eventos/cabalgata-2026.json"]);
  });

  test("un PDF no sube cartel", async () => {
    const { gh, registro } = githubFalso();
    await procesarEntradaGitHub({ ...entrada, archivo: { datos: Buffer.from("%PDF-"), tipo: "application/pdf" } }, { github: gh, extraer: programa });
    assert.ok([...registro.subidos.keys()].every((k) => k.endsWith(".json")));
    const json = JSON.parse(registro.subidos.get("data/eventos/acendido-2026.json")!.toString());
    assert.equal(json.cartel, undefined);
  });
});

describe("procesarEntrada con almacén", () => {
  const conAlmacen = async (fn: (raiz: string) => Promise<void>) => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "axenda-"));
    try {
      await fn(raiz);
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  };

  test("un pendiente por acto, con cartel; el contacto queda aparte y fuera del evento", () =>
    conAlmacen(async (raiz) => {
      const a = almacenLocal(raiz);
      const r = await procesarEntrada({ ...entrada, contacto: { canal: "whatsapp", valor: "34600000000" } }, { almacen: a, extraer: programa });
      assert.ok(r.estado === "creado" && r.eventos.length === 2);
      const pendientes = await a.pendientes();
      assert.equal(pendientes.length, 2);
      for (const p of pendientes) {
        assert.equal(p.contacto?.valor, "34600000000");
        assert.ok(p.cartel);
        assert.ok(!JSON.stringify(p.evento).includes("600"));
      }
      // El fichero del evento (el que podría acabar en git) no lleva el teléfono
      const ficheros = fs.readdirSync(path.join(raiz, "data", "pendientes")).filter((f) => f.endsWith(".json"));
      for (const f of ficheros) assert.ok(!fs.readFileSync(path.join(raiz, "data", "pendientes", f), "utf8").includes("34600000000"));
    }));

  test("el mismo archivo dos veces no gasta otra llamada a la IA", () =>
    conAlmacen(async (raiz) => {
      const a = almacenLocal(raiz);
      let llamadas = 0;
      const contar = async () => (llamadas++, extraccionOk());
      await procesarEntrada(entrada, { almacen: a, extraer: contar });
      const r = await procesarEntrada(entrada, { almacen: a, extraer: contar });
      assert.equal(r.estado, "duplicado");
      assert.equal(llamadas, 1);
    }));

  test("sin eventos en el envío", () =>
    conAlmacen(async (raiz) => {
      const r = await procesarEntrada(entrada, { almacen: almacenLocal(raiz), extraer: async () => ({ tipo: "ok", eventos: [] }) });
      assert.equal(r.estado, "vacio");
    }));
});

describe("cuerpoPR", () => {
  test("resume fecha, lugar, confianza y deducidos", () => {
    const e = evento({ sesiones: [{ inicio: "2026-11-22T17:00", nota: "Magosto" }], inferido: ["año"], lugares: [{ nombre: "Praza", lat: 42.11, lng: -8.76, aprox: true }] });
    const c = cuerpoPR(e, { errores: [], avisos: [] }, "h");
    assert.match(c, /Domingo 22 de noviembre · 17:00 · Magosto/);
    assert.match(c, /Praza _\(coordenadas aproximadas\)_/);
    assert.match(c, /Confianza de la extracción:\*\* 95 %/);
    assert.match(c, /Deducido \(revisar\):\*\* año/);
  });
});

describe("normalizarCartel", () => {
  test("reduce a 1600 px, pasa a JPEG y quita los metadatos", async () => {
    const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c33" } })
      .png()
      .withMetadata({ exif: { IFD0: { Copyright: "secreto" } } })
      .toBuffer();
    const { imagen, hash } = await normalizarCartel(original);
    const meta = await sharp(imagen).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 1600);
    assert.equal(meta.exif, undefined);
    assert.equal(hash.length, 16);
    assert.equal((await normalizarCartel(original)).hash, hash, "el mismo fichero da el mismo hash");
  });
});
