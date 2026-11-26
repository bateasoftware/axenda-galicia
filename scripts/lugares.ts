/**
 * Completa data/lugares.json con los sitios que ya salen en los eventos publicados.
 *
 *   npm run lugares            → lista lo que se podría añadir o afinar
 *   npm run lugares -- --aplicar → lo escribe en data/lugares.json (revisa el diff antes del commit)
 *
 * Los sitios con coordenadas solo aproximadas se añaden si se usan en 2 eventos o más.
 */
import fs from "node:fs";
import path from "node:path";
import { almacen, almacenDisponible } from "../src/lib/almacen";
import { aplicarSugerencias, sugerirLugares, type EventoConLugares, type TablaLugares } from "../src/lib/lugares-sugeridos";

const RUTA = path.join(process.cwd(), "data", "lugares.json");

async function main() {
  const tabla = JSON.parse(fs.readFileSync(RUTA, "utf8")) as TablaLugares;
  const dir = path.join(process.cwd(), "data", "eventos");
  const eventos: EventoConLugares[] = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  if (almacenDisponible()) eventos.push(...(await almacen().publicados()));
  else console.log("(Sin base de datos configurada: solo se miran los eventos de data/eventos)\n");

  const sugerencias = sugerirLugares(eventos, tabla);
  if (!sugerencias.length) return console.log("La tabla de lugares ya recoge todo lo publicado. 👌");
  for (const s of sugerencias)
    console.log(`${s.tipo === "nuevo" ? "＋" : "↻"} ${s.nombre} (${s.concello}) · ${s.lat}, ${s.lng}${s.aprox ? " · aprox." : ""} · ${s.usos} ${s.usos === 1 ? "evento" : "eventos"}`);

  if (!process.argv.includes("--aplicar")) return console.log(`\n${sugerencias.length} sugerencias. Para escribirlas: npm run lugares -- --aplicar`);
  const r = aplicarSugerencias(tabla, sugerencias);
  fs.writeFileSync(RUTA, JSON.stringify(r.tabla, null, 2) + "\n");
  console.log(`\n✓ ${r.anadidos} añadidos y ${r.afinados} afinados en data/lugares.json. Revisa las coordenadas aproximadas en un mapa.`);
}

main();
