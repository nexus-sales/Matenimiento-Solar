import { z } from "zod";

/** Bloques del checklist, en el orden del contrato de mantenimiento. */
export const CATEGORIAS = [
  "paneles",
  "estructura",
  "inversor",
  "cuadros_protecciones",
  "baterias",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  paneles: "Módulos / Paneles",
  estructura: "Estructuras",
  inversor: "Equipos electrónicos / Inversores",
  cuadros_protecciones: "Cuadros, cables, interruptores y protecciones",
  baterias: "Acumulación / Baterías",
};

export const ESTADOS_PUNTO = [
  "sin_revisar",
  "correcto",
  "incidencia",
  "no_aplica",
] as const;

export type EstadoPunto = (typeof ESTADOS_PUNTO)[number];

export const NOMBRE_ESTADO: Record<EstadoPunto, string> = {
  sin_revisar: "Sin revisar",
  correcto: "Correcto",
  incidencia: "Incidencia",
  no_aplica: "No aplica",
};

export const TIPOS_VISITA = ["semestral", "anual"] as const;
export type TipoVisita = (typeof TIPOS_VISITA)[number];

export const NOMBRE_TIPO_VISITA: Record<TipoVisita, string> = {
  semestral: "Semestral",
  anual: "Anual",
};

/**
 * Qué puntos entran en una visita.
 *
 * La semestral recorre solo los de 6 meses; la anual, todos — los de 12
 * meses y también los de 6, que en el año natural vuelven a tocar. Es la
 * lectura del contrato: "frecuencia 6 meses" significa dos veces al año,
 * no una vez en la visita de junio.
 */
export function itemAplicaAVisita(
  periodicidadMeses: number | null,
  tipo: TipoVisita
): boolean {
  // Sin periodicidad no es un punto de checklist —es un campo de otra
  // plantilla— y entonces la pregunta no aplica: se incluye siempre.
  if (periodicidadMeses === null) return true;
  return tipo === "anual" || periodicidadMeses <= 6;
}

/**
 * Una incidencia sin explicar no sirve de nada a la oficina: si el técnico
 * marca que algo va mal, tiene que decir qué. Es la única validación que
 * bloquea el cierre de una visita.
 */
export function incidenciaNecesitaObservacion(
  estado: EstadoPunto,
  observacion: string | null | undefined
): boolean {
  return estado === "incidencia" && !observacion?.trim();
}

export const esquemaEstadoPunto = z.enum(ESTADOS_PUNTO);
export const esquemaCategoria = z.enum(CATEGORIAS);
export const esquemaTipoVisita = z.enum(TIPOS_VISITA);
