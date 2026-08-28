/**
 * Modo de pruebas: desactiva la autenticación para poder navegar la app
 * y probar CRUD/checklist sin tener que loguearse cada vez.
 *
 * SOLO afecta al desarrollo local. Guardián incluido: si alguien lo deja
 * activado en un despliegue de producción, la app se niega a arrancar en
 * vez de servir tráfico sin autenticación.
 *
 *   AUTH_MODO_PRUEBAS=true        (en .env.local, nunca en producción)
 *   MODO_PRUEBAS_USER_ID=<uuid>   id de un usuario admin ya sembrado
 */
export function modoPruebasActivo(): boolean {
  const activo = process.env.AUTH_MODO_PRUEBAS === "true";

  if (activo && process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_MODO_PRUEBAS está activado con NODE_ENV=production. " +
        "Esto desactivaría la autenticación en un despliegue real — " +
        "la app se detiene aquí a propósito. Quita esa variable de entorno."
    );
  }

  return activo;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idUsuarioPruebas(): string {
  const id = process.env.MODO_PRUEBAS_USER_ID?.trim();

  if (!id) {
    throw new Error(
      "AUTH_MODO_PRUEBAS está activado pero falta MODO_PRUEBAS_USER_ID " +
        "(el id del usuario admin que sembró `npm run db:seed`)."
    );
  }

  // El .env.example trae un texto de ejemplo entre <>. Si se copia sin
  // sustituir, el fallo aparecía mucho más adelante como un 500 opaco
  // ("id de sesión con formato inválido") en cada llamada a la API. Se
  // detecta aquí, que es donde se puede explicar qué hacer.
  if (!UUID_RE.test(id)) {
    throw new Error(
      `MODO_PRUEBAS_USER_ID no es un UUID válido (vale "${id}"). ` +
        "Tiene que ser el id del usuario admin que imprime `npm run db:seed`, " +
        "con la forma 123e4567-e89b-12d3-a456-426614174000. " +
        "Si aún no has sembrado la base de datos, ese usuario todavía no existe."
    );
  }

  return id;
}
