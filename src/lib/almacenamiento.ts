import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Almacenamiento de fotos, hablando S3.
 *
 * Detrás hay MinIO en el mismo servidor, pero el código no lo sabe: si algún
 * día las fotos se mueven a un almacenamiento gestionado, cambian tres
 * variables de entorno y nada más.
 *
 * MinIO vive en la red interna de Docker y NO es accesible desde el
 * navegador, así que no se usan enlaces firmados: las fotos entran y salen
 * a través de la aplicación. Eso tiene una ventaja que compensa el tráfico
 * extra — cada acceso pasa por las políticas RLS, y no existe ninguna URL
 * que devuelva una foto sin sesión.
 *
 *   S3_ENDPOINT     http://nombre-interno:9000
 *   S3_BUCKET       mantenimiento-fotos
 *   S3_ACCESS_KEY   clave de acceso propia de la app, no la de root
 *   S3_SECRET_KEY
 *   S3_REGION       MinIO la ignora, pero el SDK la exige
 */

export const ALMACENAMIENTO_CONFIGURADO = Boolean(
  process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY
);

/** Tipos aceptados. Solo imágenes: esto no es un almacén de archivos. */
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * 6 MB. El móvil comprime a ~300 KB antes de subir, así que este límite solo
 * lo alcanza algo que no venga del formulario. Es una red de seguridad, no
 * el tamaño esperado.
 */
export const MAX_BYTES_FOTO = 6 * 1024 * 1024;

let clienteCache: S3Client | null = null;

function cliente(): S3Client {
  if (!ALMACENAMIENTO_CONFIGURADO) {
    throw new Error(
      "El almacenamiento de fotos no está configurado: faltan S3_ENDPOINT, " +
        "S3_BUCKET, S3_ACCESS_KEY o S3_SECRET_KEY."
    );
  }

  // Se cachea en el módulo: cada cliente abre su propio pool de conexiones,
  // y crear uno por petición las agota.
  if (!clienteCache) {
    clienteCache = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      // MinIO no sirve el estilo "bucket.dominio": el bucket va en la ruta.
      forcePathStyle: true,
    });
  }
  return clienteCache;
}

const BUCKET = () => process.env.S3_BUCKET!;

/**
 * Construye la clave del objeto a partir de la visita.
 *
 * Agrupar por visita hace que borrar un mantenimiento y limpiar sus fotos
 * sea un prefijo, no una búsqueda. El identificador aleatorio evita que dos
 * fotos subidas a la vez se pisen.
 */
export function claveFoto(
  mantenimientoId: string,
  itemId: string,
  extension: string
): string {
  const aleatorio = crypto.randomUUID();
  return `visitas/${mantenimientoId}/${itemId}/${aleatorio}.${extension}`;
}

export function extensionDe(tipo: string): string {
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  return "jpg";
}

export async function guardarFoto(
  clave: string,
  cuerpo: Buffer,
  tipo: string
): Promise<void> {
  await cliente().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: clave,
      Body: cuerpo,
      ContentType: tipo,
    })
  );
}

export async function leerFoto(
  clave: string
): Promise<{ cuerpo: Uint8Array; tipo: string } | null> {
  try {
    const res = await cliente().send(
      new GetObjectCommand({ Bucket: BUCKET(), Key: clave })
    );
    if (!res.Body) return null;
    return {
      cuerpo: await res.Body.transformToByteArray(),
      tipo: res.ContentType || "image/jpeg",
    };
  } catch (err) {
    // El objeto puede no estar si se borró por fuera. No es un fallo del
    // servidor: la fila existe y el archivo no, y quien llama lo traduce a 404.
    if (
      err instanceof Error &&
      ["NoSuchKey", "NotFound"].includes(err.name)
    ) {
      return null;
    }
    throw err;
  }
}

export async function borrarFoto(clave: string): Promise<void> {
  await cliente().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: clave })
  );
}
