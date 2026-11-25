import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriaIlustracion } from "../src/lib/categorias";

test("ilustración de un evento sin cartel: Navidad tiene preferencia, si no la primera categoría", () => {
  assert.equal(categoriaIlustracion(["infantil", "navidad"]), "navidad");
  assert.equal(categoriaIlustracion(["musica", "fiestas"]), "musica");
  assert.equal(categoriaIlustracion([]), "cultura", "sin categorías: una neutra");
});
