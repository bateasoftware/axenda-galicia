import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prepararPublicacion } from "../src/lib/admin/lote";
import { slugLibre, type Pendiente } from "../src/lib/almacen";
import { evento } from "./ayudas";

const pendiente = (c: Partial<Pendiente> = {}): Pendiente => ({ id: "p1", evento: evento({ inferido: ["año"] }), duplicados: [], creado: "2026-11-24T10:00:00Z", ...c });
const libre = () => false;

describe("prepararPublicacion (publicar por lotes)", () => {
  test("un pendiente válido se publica sin lo deducido", () => {
    const r = prepararPublicacion(pendiente(), libre, slugLibre);
    assert.ok(r.ok);
    assert.equal(r.evento.inferido, undefined);
    assert.equal(r.evento.slug, "prueba-2026");
  });

  test("si el slug está ocupado, usa el siguiente libre", () => {
    const r = prepararPublicacion(pendiente(), (s) => s === "prueba-2026", slugLibre);
    assert.ok(r.ok && r.evento.slug === "prueba-2026-2");
  });

  test("se deja el que tiene posible duplicado", () => {
    const r = prepararPublicacion(pendiente({ duplicados: ["evento:otro"] }), libre, slugLibre);
    assert.ok(!r.ok && /duplicado/.test(r.motivo));
  });

  test("se deja el que tiene email de aviso, pero no el de WhatsApp (se avisa solo)", () => {
    assert.ok(!prepararPublicacion(pendiente({ contacto: { canal: "email", valor: "a@b.es" } }), libre, slugLibre).ok);
    assert.ok(prepararPublicacion(pendiente({ contacto: { canal: "whatsapp", valor: "34600000000" } }), libre, slugLibre).ok);
  });

  test("se deja el que no pasa la validación, diciendo qué falta", () => {
    const r = prepararPublicacion(pendiente({ evento: evento({ categorias: [], sesiones: [{ inicio: "22/11" }] }) }), libre, slugLibre);
    assert.ok(!r.ok && /no se puede publicar/.test(r.motivo) && /y 1 más/.test(r.motivo));
  });
});
