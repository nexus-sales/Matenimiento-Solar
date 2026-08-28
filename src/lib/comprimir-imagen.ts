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
 *
 * NUNCA lanza. Si algo falla —falta una API, el lienzo no da contexto, la
 * imagen no decodifica— devuelve el archivo original. Perder calidad de
 * compresión es un inconveniente; perder la foto que el técnico acaba de
 * hacer en una cubierta es un viaje repetido.
 */

const LADO_MAXIMO = 1600;
const CALIDAD = 0.75;

export type ResultadoCompresion = {
  archivo: File;
  bytesOriginales: number;
  bytesFinales: number;
  /** Qué pasó. Se muestra al usuario si la compresión no pudo hacerse. */
  nota?: string;
};

function sinComprimir(original: File, nota?: string): ResultadoCompresion {
  return {
    archivo: original,
    bytesOriginales: original.size,
    bytesFinales: original.size,
    nota,
  };
}

/**
 * Decodifica la imagen a algo dibujable en un lienzo.
 *
 * `createImageBitmap` es lo mejor —respeta la orientación EXIF, así que las
 * fotos verticales no salen giradas— pero no está en todos los navegadores
 * ni en todos los modos. El respaldo con <img> funciona en cualquiera.
 */
async function decodificar(
  archivo: File
): Promise<{ fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(archivo, {
        imageOrientation: "from-image",
      });
      return {
        fuente: bitmap,
        ancho: bitmap.width,
        alto: bitmap.height,
        cerrar: () => bitmap.close(),
      };
    } catch {
      // Sigue al respaldo.
    }
  }

  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const el = new Image();
      el.onload = () => resolver(el);
      el.onerror = () => rechazar(new Error("no decodifica"));
      el.src = url;
    });
    return {
      fuente: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      cerrar: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function comprimirImagen(
  original: File,
  ladoMaximo = LADO_MAXIMO
): Promise<ResultadoCompresion> {
  try {
    const { fuente, ancho: anchoOrig, alto: altoOrig, cerrar } =
      await decodificar(original);

    const escala = Math.min(1, ladoMaximo / Math.max(anchoOrig, altoOrig));
    const ancho = Math.max(1, Math.round(anchoOrig * escala));
    const alto = Math.max(1, Math.round(altoOrig * escala));

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;

    const ctx = lienzo.getContext("2d");
    if (!ctx) {
      cerrar();
      return sinComprimir(original, "sin lienzo");
    }

    ctx.drawImage(fuente, 0, 0, ancho, alto);
    cerrar();

    const blob = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, "image/jpeg", CALIDAD)
    );

    if (!blob) return sinComprimir(original, "sin blob");

    // Si comprimir no mejora (imagen ya pequeña o muy optimizada), se queda
    // la original: recodificar solo la empeoraría.
    if (blob.size >= original.size) return sinComprimir(original);

    const nombre = (original.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    return {
      archivo: new File([blob], nombre, { type: "image/jpeg" }),
      bytesOriginales: original.size,
      bytesFinales: blob.size,
    };
  } catch (err) {
    return sinComprimir(
      original,
      err instanceof Error ? err.message : "error al comprimir"
    );
  }
}
