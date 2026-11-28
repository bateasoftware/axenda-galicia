import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { busquedasDe, enlaceOrigen, sinHora, textoBusqueda } from "../src/lib/admin/origen";
import { evento } from "./ayudas";

const fuente = (f: Partial<ReturnType<typeof evento>["fuente"]>) => ({ canal: "ics" as const, recibido: "2026-11-28T10:00", ...f });

describe("ayudas para validar pendientes sin cartel", () => {
  test("enlace de origen: el del evento, nunca la portada del portal", () => {
    assert.equal(enlaceOrigen({ fuente: fuente({ url: "https://www.cultura.gal/gl/retablo" }) }), "https://www.cultura.gal/gl/retablo");
    assert.equal(enlaceOrigen({ fuente: fuente({ url: "https://datos.vigo.org" }) }), undefined);
    assert.equal(enlaceOrigen({ fuente: fuente({}) }), undefined);
  });
  test("los de datos.vigo.org se enlazan a su página en hoxe.vigo.org aunque no guardaran la URL", () => {
    const f = fuente({ canal: "datos-abiertos", id_fuente: "vigo-agenda-cultural", uid: "3993", url: "https://datos.vigo.org" });
    assert.equal(enlaceOrigen({ fuente: f }), "https://hoxe.vigo.org/axenda/?id=3993&lang=cas");
  });
  test("búsqueda con título, fecha y lugar; y en la web del concello", () => {
    const e = evento({ titulo: "Goyo Jiménez", sesiones: [{ inicio: "2026-11-28" }], lugares: [{ nombre: "Teatro Afundación", lat: 42.2, lng: -8.7 }], concello: "Vigo" });
    assert.equal(textoBusqueda(e), "Goyo Jiménez 28 noviembre 2026 Teatro Afundación Vigo");
    const b = busquedasDe(e);
    assert.match(b.general, /^https:\/\/www\.google\.com\/search\?q=Goyo%20Jim/);
    assert.equal(b.oficial?.sitio, "vigo.org");
    assert.match(b.oficial!.url, /site%3Avigo\.org$/);
    // El concello no se repite si ya está en el nombre del lugar
    assert.equal(textoBusqueda({ ...e, lugares: [{ nombre: "Auditorio de Vigo", lat: 42.2, lng: -8.7 }] }), "Goyo Jiménez 28 noviembre 2026 Auditorio de Vigo");
  });
  test("sin hora: solo si ninguna sesión la tiene", () => {
    assert.equal(sinHora(evento({ sesiones: [{ inicio: "2026-11-28" }] })), true);
    assert.equal(sinHora(evento({ sesiones: [{ inicio: "2026-11-28" }, { inicio: "2026-11-29T18:00" }] })), false);
  });
});
