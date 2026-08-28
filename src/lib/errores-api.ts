/**
 * Lee el mensaje de error de una respuesta fallida de la API.
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
