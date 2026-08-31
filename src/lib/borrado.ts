import { eq, inArray } from "drizzle-orm";
import { intervenciones, respuestaFoto, respuestas } from "@/db/schema";
import { ALMACENAMIENTO_CONFIGURADO, borrarFoto } from "@/lib/almacenamiento";

/**
 * Borrar de verdad: la base de datos y también el almacenamiento.
 *
 * El esquema define cascadas —borrar un cliente arrastra sus intervenciones,
 * sus respuestas y las filas de sus fotos— pero PostgreSQL no sabe nada de
 * MinIO. Sin esto, las imágenes y los PDF se quedaban en el almacén para
 * siempre: inaccesibles desde la aplicación, y aun así ahí.
 *
 * No es solo espacio ocupado. Son fotos de la vivienda de alguien y actas con
 * su nombre, su DNI y su firma. La política de privacidad dice que se
 * suprimen; si no se borran, esa frase es falsa.
 */

type Tx = Parameters<Parameters<typeof import("@/db").conSesionRLS>[1]>[0];

/**
 * Reúne las claves de todo lo que hay en el almacén para unas intervenciones.
 *
 * Se llama ANTES de borrar en la base: después, la cascada ya se ha llevado
 * las filas que dicen qué archivos existían y no habría forma de saberlo.
 */
export async function clavesDeAlmacenamiento(
  tx: Tx,
  intervencionIds: string[]
): Promise<string[]> {
  if (!intervencionIds.length) return [];

  const filas = await tx
    .select({ url: respuestaFoto.url })
    .from(respuestaFoto)
    .innerJoin(respuestas, eq(respuestas.id, respuestaFoto.respuestaId))
    .where(inArray(respuestas.intervencionId, intervencionIds));

  // El acta generada se guarda con una clave fija por intervención. No tiene
  // fila propia en la base, así que se construye a partir del id.
  const informes = intervencionIds.map((id) => `visitas/${id}/informe.pdf`);

  return [...filas.map((f) => f.url), ...informes];
}

/** Las intervenciones de un cliente, para poder recoger sus claves antes. */
export async function intervencionesDe(
  tx: Tx,
  clienteId: string
): Promise<{ id: string; firmado: boolean }[]> {
  return tx
    .select({ id: intervenciones.id, firmado: intervenciones.firmado })
    .from(intervenciones)
    .where(eq(intervenciones.clienteId, clienteId));
}

/**
 * Borra del almacén, sin dejar que un fallo tumbe la operación.
 *
 * La fila ya no existe cuando esto corre, así que un archivo que se resista
 * queda huérfano —molesto— pero la alternativa sería devolver un error
 * después de haber borrado en la base, que confunde mucho más.
 */
export async function borrarDelAlmacen(claves: string[]): Promise<number> {
  if (!ALMACENAMIENTO_CONFIGURADO || !claves.length) return 0;

  const resultados = await Promise.allSettled(claves.map((c) => borrarFoto(c)));
  return resultados.filter((r) => r.status === "fulfilled").length;
}

/** Cuenta las actas firmadas de un cliente, para decidir si se puede borrar. */
export async function actasFirmadasDe(
  tx: Tx,
  clienteId: string
): Promise<number> {
  const filas = await tx
    .select({ firmado: intervenciones.firmado })
    .from(intervenciones)
    .where(eq(intervenciones.clienteId, clienteId));
  return filas.filter((f) => f.firmado).length;
}
