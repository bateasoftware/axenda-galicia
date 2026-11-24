import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { leerEventos, sinCamposInternos, validarEvento, validarLugares } from "../src/lib/validacion";
import { evento } from "./ayudas";

const RAIZ = process.cwd();

function errores(datos: unknown, fichero?: string): string[] {
  const r = validarEvento(datos, RAIZ, fichero);
  return r.ok ? [] : r.errores;
}

describe("validarEvento", () => {
  test("acepta un evento correcto", () => {
    const r = validarEvento(evento(), RAIZ, "prueba-2026.json");
    assert.ok(r.ok, JSON.stringify(r));
  });

  test("rechaza categorías que no existen", () => {
    assert.match(errores({ ...evento(), categorias: ["navida"] }).join(), /categorias\.0/);
  });

  test("rechaza fechas mal escritas y fin anterior al inicio", () => {
    assert.match(errores(evento({ sesiones: [{ inicio: "22/11/2026 17h" }] })).join(), /sesiones\.0\.inicio/);
    assert.match(
      errores(evento({ sesiones: [{ inicio: "2026-11-22T17:00", fin: "2026-11-22T16:00" }] })).join(),
      /fin es anterior a inicio/,
    );
  });

  test("rechaza coordenadas fuera de Galicia (p. ej. lat y lng cruzadas)", () => {
    const e = errores(evento({ lugares: [{ nombre: "X", lat: -8.76, lng: 42.11 }] })).join();
    assert.match(e, /lugares\.0\.lat/);
    assert.match(e, /lugares\.0\.lng/);
  });

  test("rechaza campos desconocidos (erratas en el JSON)", () => {
    assert.match(errores({ ...evento(), titlo: "errata" }).join(), /titlo|clave|key/i);
  });

  test("exige sesiones, lugares y categorías", () => {
    const e = errores(evento({ sesiones: [], lugares: [], categorias: [] })).join();
    assert.match(e, /sesión/);
    assert.match(e, /lugar/);
    assert.match(e, /categoría/);
  });

  test("el slug debe coincidir con el nombre del fichero", () => {
    assert.match(errores(evento(), "otro-nombre.json").join(), /no coincide/);
  });

  test("el cartel debe existir en public/", () => {
    assert.match(errores(evento({ cartel: "/carteles/no-existe.jpg" })).join(), /no existe/);
  });

  test("da avisos sin bloquear: confianza baja, coordenadas aproximadas, deducidos", () => {
    const r = validarEvento(
      evento({ confianza: 0.5, inferido: ["año"], lugares: [{ nombre: "Praza", lat: 42.11, lng: -8.76, aprox: true }] }),
      RAIZ,
    );
    assert.ok(r.ok);
    assert.equal(r.avisos.length, 3);
  });
});

describe("leerEventos", () => {
  test("separa los JSON rotos y lee los válidos", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "axenda-"));
    try {
      fs.writeFileSync(path.join(dir, "a-2026.json"), JSON.stringify(evento({ slug: "a-2026" })));
      fs.writeFileSync(path.join(dir, "roto.json"), '{"slug": ');
      const r = leerEventos(dir, RAIZ);
      assert.equal(r.eventos.length, 1);
      assert.deepEqual(
        r.problemas.map((p) => p.fichero),
        ["roto.json"],
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("en pendientes ignora los campos internos del extractor", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "axenda-"));
    try {
      fs.writeFileSync(path.join(dir, "prueba-2026.json"), JSON.stringify({ ...evento(), _imagen: "IMG.jpg" }));
      assert.equal(leerEventos(dir, RAIZ).problemas.length, 1, "como evento publicado, _imagen sobra");
      assert.equal(leerEventos(dir, RAIZ, { pendientes: true }).problemas.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("sinCamposInternos quita solo lo que empieza por _", () => {
    assert.deepEqual(sinCamposInternos({ _imagen: "x", slug: "a" }), { slug: "a" });
  });
});

describe("datos del repositorio", () => {
  test("todos los eventos de data/eventos son válidos", () => {
    const r = leerEventos(path.join(RAIZ, "data", "eventos"), RAIZ);
    assert.deepEqual(r.problemas, []);
    assert.ok(r.eventos.length > 0);
  });

  test("data/lugares.json es válido", () => {
    assert.deepEqual(validarLugares(RAIZ), []);
  });
});
