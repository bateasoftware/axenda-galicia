import { describe, test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { cuerpoPR, ETIQUETA, limpiarSlug, procesarEntrada, slugLibre, type Entrada } from "../src/lib/entrada";
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
const extraccionOk = async (): Promise<ResultadoExtraccion> => ({ tipo: "ok", evento: { ...extraido, slug: "Magosto Gondomar 2026" } });

const entrada: Entrada = { imagen: Buffer.from("jpeg"), hash: "abc123", canal: "email", recibido: "2026-11-19T09:52", nota: "Tel. 600 000 000" };

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

describe("procesarEntrada", () => {
  test("crea rama, sube cartel y JSON, y abre el PR etiquetado", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntrada(entrada, { github: gh, extraer: extraccionOk });
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
    await procesarEntrada(entrada, { github: gh, extraer: extraccionOk });
    assert.ok(!registro.creados[0].cuerpo.includes("600 000 000"));
    assert.ok(registro.creados[0].cuerpo.includes("<!-- axenda:hash=abc123 -->"));
  });

  test("un cartel repetido no abre otro PR: comenta en el abierto", async () => {
    const previo: PR = { numero: 3, url: "https://github.com/x/y/pull/3", estado: "open", fusionado: false, cuerpo: "…<!-- axenda:hash=abc123 -->" };
    const { gh, registro } = githubFalso({ prs: [previo] });
    let llamadas = 0;
    const r = await procesarEntrada(entrada, { github: gh, extraer: async () => (llamadas++, extraccionOk()) });
    assert.deepEqual(r, { estado: "duplicado", pr: previo.url });
    assert.equal(llamadas, 0, "no gasta una llamada a la IA");
    assert.equal(registro.comentarios.length, 1);
    assert.equal(registro.creados.length, 0);
  });

  test("si el modelo lo rechaza, no toca GitHub", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntrada(entrada, { github: gh, extraer: async () => ({ tipo: "rechazado", categoria: "general_harms" }) });
    assert.equal(r.estado, "rechazado");
    assert.equal(registro.subidos.size, 0);
  });

  test("con errores de validación abre el PR igualmente, marcado para corregir", async () => {
    const { gh, registro } = githubFalso();
    const r = await procesarEntrada(entrada, {
      github: gh,
      extraer: async () => ({ tipo: "ok", evento: { ...extraido, slug: "x-2026", categorias: [], sesiones: [{ inicio: "22/11" }] } }),
    });
    assert.equal(r.estado, "creado");
    assert.ok(r.estado === "creado" && r.errores.length >= 2);
    assert.match(registro.creados[0].titulo, /^⚠️/);
    assert.match(registro.creados[0].cuerpo, /Hay que corregir/);
  });
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
