import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { enlaceBuscarSitio, enlaceCoordenadas, formatoCoordenadas, parsearCoordenadas } from "../src/lib/coordenadas";

describe("coordenadas estilo Google Maps", () => {
  test("lo que se copia de Google Maps", () => {
    assert.deepEqual(parsearCoordenadas("42.11150, -8.76080"), { lat: 42.1115, lng: -8.7608 });
    assert.deepEqual(parsearCoordenadas("  42.1115,-8.7608 "), { lat: 42.1115, lng: -8.7608 });
  });
  test("separadas por espacio, punto y coma o con coma decimal", () => {
    assert.deepEqual(parsearCoordenadas("42.1115 -8.7608"), { lat: 42.1115, lng: -8.7608 });
    assert.deepEqual(parsearCoordenadas("42,1115; -8,7608"), { lat: 42.1115, lng: -8.7608 });
    assert.deepEqual(parsearCoordenadas("42,1115 -8,7608"), { lat: 42.1115, lng: -8.7608 });
  });
  test("enlaces de Google Maps", () => {
    assert.deepEqual(parsearCoordenadas("https://www.google.com/maps/place/Praza/@42.1115,-8.7608,17z/data=x"), { lat: 42.1115, lng: -8.7608 });
    assert.deepEqual(parsearCoordenadas("https://maps.google.com/?q=42.1115,-8.7608"), { lat: 42.1115, lng: -8.7608 });
    assert.deepEqual(parsearCoordenadas("https://www.google.com/maps/place/x/data=!3d42.1115!4d-8.7608"), { lat: 42.1115, lng: -8.7608 });
  });
  test("errores comprensibles", () => {
    assert.match((parsearCoordenadas("hola") as { error: string }).error, /no entiendo/);
    assert.match((parsearCoordenadas("-8.7608, 42.1115") as { error: string }).error, /al revés/);
    assert.match((parsearCoordenadas("40.4168, -3.7038") as { error: string }).error, /Galicia/);
    assert.match((parsearCoordenadas("42.1") as { error: string }).error, /no entiendo/);
  });
  test("formato y enlaces", () => {
    assert.equal(formatoCoordenadas(42.11150001, -8.76), "42.1115, -8.76");
    assert.equal(enlaceCoordenadas(42.1115, -8.7608), "https://www.google.com/maps/search/?api=1&query=42.1115%2C-8.7608");
    assert.match(enlaceBuscarSitio("Praza Paradela", "Gondomar"), /query=Praza%20Paradela%2C%20Gondomar%2C%20Galicia$/);
    assert.deepEqual(parsearCoordenadas(formatoCoordenadas(42.123456, -8.654321)), { lat: 42.123456, lng: -8.654321 });
  });
});
