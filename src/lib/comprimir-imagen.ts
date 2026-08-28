/**
 * Comprime una foto en el propio dispositivo antes de subirla.
 *
 * Una foto de móvil son 3-5 MB. A 1600 px de lado mayor y calidad 75 baja a
 * unos 300 KB: doce veces menos datos y doce veces menos espera para un
 * técnico que está en una cubierta con la cobertura que haya. En el informe
 * se ve exactamente igual.
 *
 * Se hace en el cliente a propósito. Comprimir en el servidor obligaría a
 * subir los 4 MB primero, que es justo lo que duele.
 */

const LADO_MAXIMO = 1600;
const CALIDAD = 0.75;

export type ResultadoCompresion = {
  archivo: File;
  bytesOriginales: number;
  bytesFinales: number;
};

export async function comprimirImagen(
  original: File,
  ladoMaximo = LADO_MAXIMO
): Promise<ResultadoCompresion> {
  // createImageBitmap respeta la orientación EXIF; sin eso, las fotos
  // hechas en vertical se guardarían giradas.
  const bitmap = await createImageBitmap(original, {
    imageOrientation: "from-image",
  });

  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");
  if (!ctx) {
    // Sin canvas no se puede comprimir; se sube el original antes que perder
    // la foto, que es el dato que de verdad importa.
    bitmap.close();
    return {
      archivo: original,
      bytesOriginales: original.size,
      bytesFinales: original.size,
    };
  }

  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", CALIDAD)
  );

  if (!blob) {
    return {
      archivo: original,
      bytesOriginales: original.size,
      bytesFinales: original.size,
    };
  }

  // Si comprimir no mejora (una imagen ya pequeña o muy optimizada), se
  // queda la original: no tiene sentido recodificar para empeorarla.
  if (blob.size >= original.size) {
    return {
      archivo: original,
      bytesOriginales: original.size,
      bytesFinales: original.size,
    };
  }

  const nombre = original.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    archivo: new File([blob], nombre, { type: "image/jpeg" }),
    bytesOriginales: original.size,
    bytesFinales: blob.size,
  };
}
