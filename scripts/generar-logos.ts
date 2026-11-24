/**
 * Genera los logos e iconos de la web a partir de la imagen original (marca/axenda-logo-original.webp):
 * recorta el logo completo y el icono solo, y prepara los iconos de la app.
 *
 *   npm run logos
 *
 * El original tiene que ser el logo con fondo transparente: icono a la izquierda y texto a la derecha.
 * Para cambiar la marca, sustituye el original y ejecútalo.
 * Salidas: public/marca/logo.png, public/marca/icono.png, src/app/icon.png, src/app/apple-icon.png,
 *          public/icon-192.png, public/icon-512.png y public/icon-maskable-512.png
 */
import path from "node:path";
import sharp from "sharp";

const RAIZ = process.cwd();
const ORIGINAL = path.join(RAIZ, "marca", "axenda-logo-original.webp");
const CREMA = "#fcfaf6";
const AZUL = { r: 1, g: 35, b: 64 }; // fondo del icono
const UMBRAL = 12; // opacidad mínima para contar como "hay contenido"

async function main() {
  const { data, info } = await sharp(ORIGINAL).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const hayContenido = (x: number, y: number) => data[(y * W + x) * 4 + 3] > UMBRAL;
  const columnaVacia = (x: number) => {
    for (let y = 0; y < H; y++) if (hayContenido(x, y)) return false;
    return true;
  };

  // Caja del logo completo
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (hayContenido(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  // Donde acaba el icono: la primera columna vacía ancha tras el icono
  let finIcono = x0;
  while (finIcono < x1 && !columnaVacia(finIcono)) finIcono++;
  finIcono--;

  const caja = (izq: number, der: number) => ({ left: izq, top: y0, width: der - izq + 1, height: y1 - y0 + 1 });
  const completo = () => sharp(ORIGINAL).ensureAlpha().extract(caja(x0, x1));
  const icono = () => sharp(ORIGINAL).ensureAlpha().extract(caja(x0, finIcono));

  const guardar = async (img: ReturnType<typeof sharp>, destino: string) => {
    await img.png({ compressionLevel: 9 }).toFile(path.join(RAIZ, destino));
    console.log("✓", destino);
  };

  // Logo completo e icono solo (cabecera), en alta resolución para pantallas retina
  await guardar(completo().resize({ height: 240 }), "public/marca/logo.png");
  await guardar(icono().resize({ height: 240 }), "public/marca/icono.png");

  // Iconos cuadrados: el icono centrado en un lienzo cuadrado, con o sin fondo
  const iconoBuf = await icono().png().toBuffer();
  const cuadrado = async (lado: number, relleno: number, fondo?: string) => {
    const ancho = Math.round(lado * (1 - 2 * relleno));
    const interior = await sharp(iconoBuf).resize({ width: ancho }).toBuffer();
    const alto = (await sharp(interior).metadata()).height!;
    return sharp({ create: { width: lado, height: lado, channels: 4, background: fondo ?? { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
      { input: interior, left: Math.round((lado - ancho) / 2), top: Math.round((lado - alto) / 2) },
    ]);
  };
  // iOS pone su propio recuadro redondeado y no admite transparencia: el icono tiene que llenar todo el cuadrado.
  // Se recorta un poco el borde (las esquinas redondeadas) y se completa con el azul del fondo.
  const sangrado = async (lado: number) => {
    const meta = await sharp(iconoBuf).metadata();
    const recorte = Math.round(meta.height! * 0.07);
    const ancho = meta.width! - 2 * recorte;
    const alto = meta.height! - 2 * recorte;
    const centro = await sharp(iconoBuf).extract({ left: recorte, top: recorte, width: ancho, height: alto }).png().toBuffer();
    // Primero se compone y luego se redimensiona (sharp redimensiona antes de componer)
    const cuadrado = await sharp({ create: { width: ancho, height: ancho, channels: 4, background: { ...AZUL, alpha: 1 } } })
      .composite([{ input: centro, left: 0, top: Math.round((ancho - alto) / 2) }])
      .png()
      .toBuffer();
    return sharp(cuadrado).flatten({ background: AZUL }).resize(lado, lado);
  };
  await guardar(await cuadrado(256, 0.02), "src/app/icon.png"); // favicon y pestañas
  await guardar(await sangrado(180), "src/app/apple-icon.png"); // pantalla de inicio de iOS
  await guardar(await cuadrado(192, 0.02), "public/icon-192.png");
  await guardar(await cuadrado(512, 0.02), "public/icon-512.png");
  await guardar(await cuadrado(512, 0.22, CREMA), "public/icon-maskable-512.png"); // zona segura de los iconos adaptables
  console.log(`Logo: ${x1 - x0 + 1}×${y1 - y0 + 1} px; icono: ${finIcono - x0 + 1} px de ancho`);
}

main();
