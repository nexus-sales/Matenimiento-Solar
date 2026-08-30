/**
 * Las tres plantillas y los bloques en que se agrupan sus campos.
 *
 * El bloque dejó de ser un enum en la base de datos (migración 0005) para que
 * un instalador pueda crearse los suyos sin tocar el esquema. Eso deja aquí la
 * lista de bloques conocidos: la base admite cualquier texto, y esta tabla
 * solo dice cómo se llama cada uno en pantalla y en qué orden aparece.
 *
 * Un bloque que llegue de la base y no esté aquí se muestra igualmente, con su
 * propia clave como título — mejor un nombre feo que un formulario que se come
 * campos en silencio.
 */

export const PLANTILLAS = ["mantenimiento", "visita_previa", "acta_obra"] as const;
export type Plantilla = (typeof PLANTILLAS)[number];

export const NOMBRE_PLANTILLA: Record<Plantilla, string> = {
  mantenimiento: "Visita de mantenimiento",
  visita_previa: "Visita previa",
  acta_obra: "Acta de finalización de obra",
};

/** Cómo se llama cada plantilla en singular, para títulos y botones. */
export const NOMBRE_CORTO_PLANTILLA: Record<Plantilla, string> = {
  mantenimiento: "Mantenimiento",
  visita_previa: "Visita previa",
  acta_obra: "Acta de obra",
};

type Bloque = { clave: string; nombre: string };

/** En este orden se recorren en el formulario y se imprimen en el informe. */
export const BLOQUES: Record<Plantilla, readonly Bloque[]> = {
  mantenimiento: [
    { clave: "paneles", nombre: "Módulos / Paneles" },
    { clave: "estructura", nombre: "Estructuras" },
    { clave: "inversor", nombre: "Equipos electrónicos / Inversores" },
    { clave: "cuadros_protecciones", nombre: "Cuadros, cables, interruptores y protecciones" },
    { clave: "baterias", nombre: "Acumulación / Baterías" },
  ],
  visita_previa: [
    { clave: "cubierta", nombre: "Datos generales de la cubierta" },
    { clave: "sombras", nombre: "Sombras" },
    { clave: "acceso", nombre: "Acceso a la cubierta" },
    { clave: "canalizacion_dc", nombre: "Canalización DC" },
    { clave: "instalacion", nombre: "Instalación y cableado" },
    { clave: "canalizacion_ac", nombre: "Canalización AC" },
    { clave: "conectividad", nombre: "Conectividad" },
    { clave: "equipos", nombre: "Equipos" },
    { clave: "exteriores", nombre: "Exteriores de la vivienda" },
    { clave: "cierre", nombre: "Cierre" },
  ],
  acta_obra: [
    { clave: "equipos", nombre: "Instalación y equipos" },
    { clave: "preinstalacion", nombre: "Antes de instalar" },
    { clave: "estructura", nombre: "Estructura y anclajes" },
    { clave: "paneles", nombre: "Paneles y cableado en cubierta" },
    { clave: "canalizacion_dc", nombre: "Canalización DC" },
    { clave: "equipos_ac", nombre: "Equipos y AC" },
    { clave: "canalizacion_ac", nombre: "Canalización AC" },
    { clave: "cierre", nombre: "Finalización de obra" },
  ],
};

/**
 * Ordena los bloques que de verdad tiene una intervención.
 *
 * Se parte de los campos, no de la lista de arriba: si el administrador
 * desactivó un bloque entero, no debe aparecer vacío. Y si añadió uno que no
 * conocemos, va al final en lugar de desaparecer.
 */
export function bloquesDe(
  plantilla: Plantilla,
  clavesPresentes: readonly string[]
): Bloque[] {
  const presentes = new Set(clavesPresentes);
  const conocidos = BLOQUES[plantilla].filter((b) => presentes.has(b.clave));
  const sobrantes = [...presentes]
    .filter((c) => !BLOQUES[plantilla].some((b) => b.clave === c))
    .map((clave) => ({ clave, nombre: clave }));
  return [...conocidos, ...sobrantes];
}

export function nombreBloque(plantilla: Plantilla, clave: string): string {
  return BLOQUES[plantilla].find((b) => b.clave === clave)?.nombre ?? clave;
}

/**
 * Si un campo impide firmar.
 *
 * El checklist de mantenimiento exige los 24 puntos: dejar uno sin mirar es
 * dejar la visita a medias. En la visita previa y el acta no vale la misma
 * regla — hay campos que sencillamente no aplican a esa obra (la marca de la
 * batería cuando no lleva batería, la sexta foto de canalización cuando el
 * recorrido se ve en tres), y exigirlos todos obligaría al técnico a
 * rellenar basura para poder cerrar. Ahí solo bloquean los marcados como
 * obligatorios, que son los que el formulario original marca con "Obligatorio!".
 *
 * Vive aquí y no en la pantalla porque el servidor tiene que aplicar la misma
 * regla al firmar: si solo la comprobara el navegador, no la comprobaría nadie.
 */
export function campoPendiente(
  campo: { tipo: string; obligatorio: boolean },
  respuesta: { estado?: string | null; valor?: string | null } | null,
  numFotos: number
): boolean {
  if (campo.tipo === "estado") {
    return !respuesta || respuesta.estado === "sin_revisar";
  }
  if (!campo.obligatorio) return false;
  if (campo.tipo === "foto") return numFotos === 0;
  return !respuesta?.valor?.trim();
}
