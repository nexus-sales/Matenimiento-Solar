/**
 * Lee el mensaje de error de una respuesta fallida de la API.
 *
 * Si la respuesta es un 401, además lleva al usuario al login: la sesión ha
 * caducado y no hay nada que pueda hacer desde donde está.
 *
 * Las rutas de la API devuelven `{ error: "..." }`, pero un fallo no
 * controlado (una excepción dentro del route handler) devuelve un 500 con
 * el cuerpo vacío. Hacer `res.json()` a pelo en ese caso revienta con
 * "Unexpected end of JSON input" y el usuario se queda sin ver nada.
 */
export async function leerErrorApi(
  res: Response,
  porDefecto: string
): Promise<string> {
  // La sesión dura 12 horas; caducarla con la app abierta es lo normal, no
  // una excepción. Mostrar "no autenticado" y dejar ahí al usuario sería
  // enseñarle un problema que no puede resolver desde esa pantalla.
  if (res.status === 401 && typeof window !== "undefined") {
    // Recarga completa a propósito, no router.push(): al caducar la sesión
    // interesa tirar todo el estado del cliente, que quedó ligado a un
    // usuario que ya no lo es. Una navegación del enrutador lo conservaría.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    return "Tu sesión ha caducado. Volviendo al inicio de sesión…";
  }

  let texto = "";
  try {
    texto = await res.text();
  } catch {
    return porDefecto;
  }

  if (!texto.trim()) {
    return res.status >= 500
      ? "Error del servidor. Revisa el registro del servidor para ver el detalle."
      : porDefecto;
  }

  try {
    const datos = JSON.parse(texto);
    return typeof datos?.error === "string" ? datos.error : porDefecto;
  } catch {
    // Cuerpo que no es JSON (una página de error HTML, por ejemplo).
    return porDefecto;
  }
}
