/**
 * Geografía canaria. El módulo de clientes es el que alimenta al resto,
 * así que la lista de islas y su provincia viven aquí, en un solo sitio:
 * los desplegables, la validación del servidor y el código postal salen
 * todos de estas constantes.
 */

export const ISLAS_CANARIAS = [
  "Tenerife",
  "Gran Canaria",
  "Lanzarote",
  "Fuerteventura",
  "La Palma",
  "La Gomera",
  "El Hierro",
  "La Graciosa",
] as const;

export type IslaCanaria = (typeof ISLAS_CANARIAS)[number];

export const PROVINCIAS_CANARIAS = [
  "Las Palmas",
  "Santa Cruz de Tenerife",
] as const;

export type ProvinciaCanaria = (typeof PROVINCIAS_CANARIAS)[number];

/**
 * La provincia no se pregunta: en Canarias la determina la isla sin
 * ambigüedad. Se guarda igualmente en el cliente para que los listados y
 * las exportaciones la lleven, pero se calcula, nunca se teclea.
 */
const PROVINCIA_POR_ISLA: Record<IslaCanaria, ProvinciaCanaria> = {
  "Gran Canaria": "Las Palmas",
  Lanzarote: "Las Palmas",
  Fuerteventura: "Las Palmas",
  "La Graciosa": "Las Palmas",
  Tenerife: "Santa Cruz de Tenerife",
  "La Palma": "Santa Cruz de Tenerife",
  "La Gomera": "Santa Cruz de Tenerife",
  "El Hierro": "Santa Cruz de Tenerife",
};

export function provinciaDeIsla(isla: string | null | undefined) {
  if (!isla) return null;
  return PROVINCIA_POR_ISLA[isla as IslaCanaria] ?? null;
}

/** Prefijo de código postal de cada provincia canaria. */
const PREFIJO_CP: Record<ProvinciaCanaria, string> = {
  "Las Palmas": "35",
  "Santa Cruz de Tenerife": "38",
};

export function prefijoCodigoPostal(isla: string | null | undefined) {
  const provincia = provinciaDeIsla(isla);
  return provincia ? PREFIJO_CP[provincia] : null;
}

/**
 * Comprueba que el código postal case con la isla elegida. Devuelve null si
 * todo cuadra, o el motivo si no: un 38xxx en Lanzarote es casi siempre un
 * error de tecleo, y es más barato avisarlo en el alta que perseguirlo
 * después en el histórico de mantenimientos.
 */
export function desajusteCodigoPostal(
  codigoPostal: string | null | undefined,
  isla: string | null | undefined
): string | null {
  if (!codigoPostal || !isla) return null;
  const prefijo = prefijoCodigoPostal(isla);
  if (!prefijo || codigoPostal.startsWith(prefijo)) return null;
  return `El código postal de ${isla} empieza por ${prefijo}.`;
}
