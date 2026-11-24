// Solo para el navegador: reduce las fotos grandes (máx. 2000 px, JPEG) para no pasar del límite de 4 MB.
export const MAX_BYTES_ARCHIVO = 4 * 1024 * 1024;

export async function reducirImagen(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/") || f.size < 1.5 * 1024 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.85));
    return blob ?? f;
  } catch {
    return f; // formatos que el navegador no sabe abrir (p. ej. HEIC fuera de Safari)
  }
}
