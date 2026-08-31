/**
 * Identidad legal de quien explota la aplicación, y el inventario real de
 * datos que trata.
 *
 * Vive aquí y no en la base de datos porque es identidad del despliegue —como
 * la conexión o el dominio—, y cada instalador tiene la suya: esta aplicación
 * se despliega una vez por cliente. Cambiar de instalador es cambiar estas
 * variables, no migrar nada.
 *
 * IMPORTANTE: los textos legales de /legal se construyen a partir de estas
 * constantes. Un dato que falte sale marcado como pendiente en la página, y
 * Configuración avisa de cuáles faltan. No se inventa ninguno: un aviso legal
 * con un CIF equivocado es peor que no tenerlo.
 */

function env(clave: string): string | null {
  const v = process.env[clave]?.trim();
  return v ? v : null;
}

/** El RESPONSABLE del tratamiento: la instaladora, dueña de los datos. */
export const RESPONSABLE = {
  nombre: env("LEGAL_RESPONSABLE_NOMBRE") ?? "SR Energía",
  cif: env("LEGAL_RESPONSABLE_CIF"),
  direccion: env("LEGAL_RESPONSABLE_DIRECCION"),
  email: env("LEGAL_RESPONSABLE_EMAIL"),
  telefono: env("LEGAL_RESPONSABLE_TELEFONO"),
  /** Solo si lo han designado. La mayoría de las pymes no están obligadas. */
  dpd: env("LEGAL_DPD_CONTACTO"),
};

/**
 * El ENCARGADO del tratamiento: quien desarrolla y mantiene la aplicación.
 *
 * La distinción no es formal. El responsable decide para qué se tratan los
 * datos; el encargado solo los trata siguiendo sus instrucciones. Entre los
 * dos hace falta un contrato del artículo 28 del RGPD, que es un documento
 * legal aparte y no algo que resuelva el código.
 */
export const ENCARGADO = {
  nombre: env("LEGAL_ENCARGADO_NOMBRE") ?? "Grupo LMB",
  email: env("LEGAL_ENCARGADO_EMAIL") ?? "admin@nexus-sales.eu",
};

/** Dónde se alojan los datos. Es un subencargado y hay que declararlo. */
export const ALOJAMIENTO = {
  proveedor: env("LEGAL_ALOJAMIENTO") ?? "Hetzner Online GmbH",
  ubicacion: env("LEGAL_ALOJAMIENTO_UBICACION") ?? "Alemania (Unión Europea)",
};

/** Qué falta por rellenar. Configuración lo muestra a administración. */
export function datosLegalesPendientes(): string[] {
  const faltan: string[] = [];
  if (!RESPONSABLE.cif) faltan.push("CIF o NIF del responsable");
  if (!RESPONSABLE.direccion) faltan.push("Domicilio del responsable");
  if (!RESPONSABLE.email) faltan.push("Email de contacto para ejercer derechos");
  return faltan;
}

export const LEGAL_COMPLETO = datosLegalesPendientes().length === 0;

/**
 * El único almacenamiento que la aplicación deja en el navegador.
 *
 * Comprobado leyendo el código, no supuesto: una cookie de sesión y dos
 * preferencias de interfaz. No hay analítica, ni medición, ni ningún recurso
 * de un tercero — ni siquiera las fuentes, que no se cargan de fuera.
 */
export const ALMACENAMIENTO_NAVEGADOR = [
  {
    nombre: "sesion",
    tipo: "Cookie propia",
    finalidad:
      "Mantener la sesión iniciada. Sin ella habría que introducir la " +
      "contraseña en cada pantalla.",
    duracion: "12 horas",
    detalle:
      "httpOnly (el JavaScript de la página no puede leerla), Secure y " +
      "SameSite=Lax. Contiene el identificador, el rol y el nombre del " +
      "usuario, firmados; no contiene la contraseña.",
    exenta: true,
  },
  {
    nombre: "sr-tema",
    tipo: "Almacenamiento local",
    finalidad: "Recordar si se eligió modo claro u oscuro.",
    duracion: "Hasta que se borre desde el navegador",
    detalle:
      "Solo se escribe si el usuario elige un tema. Con la opción «sistema» " +
      "no se guarda nada.",
    exenta: true,
  },
  {
    nombre: "sr-sidebar-plegado",
    tipo: "Almacenamiento local",
    finalidad: "Recordar si el menú lateral quedó plegado.",
    duracion: "Hasta que se borre desde el navegador",
    detalle: "Solo se escribe al plegar o desplegar el menú.",
    exenta: true,
  },
] as const;

/**
 * Categorías de datos personales que trata la aplicación.
 *
 * Sale del esquema real de la base de datos. Sirve para la información del
 * artículo 13 y como anexo técnico del registro de actividades de tratamiento
 * que el responsable está obligado a llevar (artículo 30).
 */
export const CATEGORIAS_DATOS = [
  {
    grupo: "Clientes de la instaladora",
    datos:
      "Nombre, documento de identidad, dirección, código postal, isla, " +
      "teléfono, correo electrónico, y los datos de su instalación " +
      "fotovoltaica (CUPS, potencias, inversor, comercializadora).",
    origen: "Facilitados por el propio cliente a la instaladora.",
  },
  {
    grupo: "Fotografías de las instalaciones",
    datos:
      "Imágenes de cubiertas, fachadas, cuadros eléctricos y equipos, " +
      "tomadas durante la visita.",
    origen: "Captadas por el técnico en el domicilio o local del cliente.",
  },
  {
    grupo: "Firmas de conformidad",
    datos:
      "Firma manuscrita —una imagen del trazo—, nombre y documento de " +
      "identidad de quien firma, por parte del técnico y del cliente.",
    origen: "Recogidas en el momento de cerrar la visita.",
  },
  {
    grupo: "Personal de la instaladora",
    datos:
      "Nombre, correo electrónico, documento de identidad, isla asignada y " +
      "rol dentro de la aplicación.",
    origen: "Alta realizada por administración.",
  },
] as const;

/**
 * Medidas del artículo 32, descritas como están implementadas de verdad.
 *
 * Cada punto se corresponde con algo que existe en el código y se puede
 * comprobar. Prometer medidas que no están es exactamente el tipo de
 * declaración que se vuelve en contra en una inspección.
 */
export const MEDIDAS_SEGURIDAD = [
  "El acceso exige usuario y contraseña. Las contraseñas se guardan cifradas " +
    "con bcrypt y no son recuperables: ni siquiera administración puede leerlas.",
  "La separación entre lo que ve cada persona la aplica la propia base de " +
    "datos mediante políticas de seguridad a nivel de fila, no la pantalla. " +
    "Un técnico no puede leer las visitas de otro ni aunque manipule el navegador.",
  "El técnico solo accede a los datos de los clientes de las visitas que " +
    "tiene asignadas, salvo excepción concedida expresamente por administración.",
  "Las fotografías no tienen dirección pública: se sirven a través de la " +
    "aplicación y cada acceso vuelve a comprobar los permisos. Un enlace " +
    "reenviado no funciona para quien no tenga sesión.",
  "El tráfico viaja cifrado mediante HTTPS, con la cabecera HSTS activada.",
  "El acceso se limita a ocho intentos fallidos cada quince minutos, por " +
    "cuenta y por dirección IP.",
  "Un acta firmada queda inmutable: ni el técnico ni la oficina pueden " +
    "modificarla. Si se firmó por error se anula dejando constancia de quién " +
    "y por qué, pero su contenido no se altera.",
  "Los datos se alojan en servidores situados en la Unión Europea.",
] as const;

/**
 * Plazo de conservación.
 *
 * No es una cifra escogida al azar: las actas documentan la ejecución de un
 * contrato y respaldan la garantía de la instalación, así que se conservan
 * mientras puedan servir para atender o defender una reclamación.
 */
export const CONSERVACION =
  "Los datos se conservan mientras dure la relación con el cliente y, " +
  "después, bloqueados durante los plazos de prescripción legal —seis años " +
  "para la documentación mercantil y cinco para las acciones contractuales—, " +
  "transcurridos los cuales se suprimen.";
