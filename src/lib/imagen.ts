import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Deja el cartel listo para publicar y para la API: girado según EXIF, como máximo 1600 px
 * por lado y en JPEG. sharp no copia los metadatos (ubicación GPS, modelo de móvil…).
 */
export async function normalizarCartel(original: Buffer): Promise<{ imagen: Buffer; hash: string }> {
  const imagen = await sharp(original, { failOn: "error" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  // El hash es del fichero recibido: el mismo cartel reenviado da el mismo hash
  return { imagen, hash: createHash("sha256").update(original).digest("hex").slice(0, 16) };
}
