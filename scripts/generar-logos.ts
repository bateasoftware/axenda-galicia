/**
 * Genera los iconos de la web a partir del símbolo de la marca (src/lib/marca.ts, todo en SVG):
 *
 *   npm run logos
 *
 * Salidas:
 *  - marca/simbolo.svg, marca/icono-app.svg: la marca en vectorial, para usar fuera de la web
 *  - src/app/icon.png (favicon y pestañas): el símbolo sobre transparente
 *  - src/app/apple-icon.png (iOS): el icono de app a sangre (iOS pone sus esquinas y no admite transparencia)
 *  - public/icon-192.png, public/icon-512.png (PWA) y public/icon-maskable-512.png (Android, se recorta en círculo)
 * El logotipo «altofalante» no es una imagen: se escribe con Space Grotesk y el símbolo (src/components/Marca.tsx).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { svgIconoApp, svgSimbolo } from "../src/lib/marca";

const RAIZ = process.cwd();

async function png(svg: string, lado: number, destino: string) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(lado, lado).png({ compressionLevel: 9 }).toFile(path.join(RAIZ, destino));
  console.log("✓", destino);
}

async function main() {
  fs.writeFileSync(path.join(RAIZ, "marca/simbolo.svg"), svgSimbolo() + "\n");
  fs.writeFileSync(path.join(RAIZ, "marca/icono-app.svg"), svgIconoApp({ redondeo: 22 }) + "\n");
  console.log("✓ marca/simbolo.svg, marca/icono-app.svg");

  await png(svgSimbolo(), 256, "src/app/icon.png");
  await png(svgIconoApp(), 180, "src/app/apple-icon.png");
  await png(svgIconoApp({ redondeo: 22 }), 192, "public/icon-192.png");
  await png(svgIconoApp({ redondeo: 22 }), 512, "public/icon-512.png");
  // Zona segura de los iconos adaptables: el símbolo, más pequeño, dentro del círculo central
  await png(svgIconoApp({ zona: 0.44 }), 512, "public/icon-maskable-512.png");
}

main();
