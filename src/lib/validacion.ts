const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

/** DNI: 8 dígitos + letra de control. */
function validarDNIEstricto(numero: string, letra: string): boolean {
  const letraEsperada = LETRAS_DNI[parseInt(numero, 10) % 23];
  return letra === letraEsperada;
}

/** NIE: X/Y/Z + 7 dígitos + letra de control (mismo cálculo que el DNI,
 * sustituyendo la letra inicial por 0/1/2). */
function validarNIE(prefijo: string, numero: string, letra: string): boolean {
  const mapa: Record<string, string> = { X: "0", Y: "1", Z: "2" };
  const numeroCompleto = mapa[prefijo] + numero;
  const letraEsperada = LETRAS_DNI[parseInt(numeroCompleto, 10) % 23];
  return letra === letraEsperada;
}

/**
 * Valida el documento identificativo del cliente: DNI, NIE o CIF español.
 * - DNI y NIE: formato + letra de control verificados matemáticamente.
 * - CIF (empresas): solo se verifica el formato (letra de tipo de entidad +
 *   7 dígitos + dígito/letra de control). El dígito de control del CIF
 *   depende del tipo de entidad y no se valida aquí — el objetivo es
 *   filtrar errores de tecleo obvios, no ser un validador fiscal completo.
 */
export function validarDocumento(valor: string): boolean {
  const v = valor.trim().toUpperCase();

  const dni = /^(\d{8})([A-Z])$/.exec(v);
  if (dni) return validarDNIEstricto(dni[1], dni[2]);

  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(v);
  if (nie) return validarNIE(nie[1], nie[2], nie[3]);

  const cif = /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-Z]$/.exec(v);
  if (cif) return true;

  return false;
}

/** Valida formato de CUPS español (ES + 16 dígitos + 2 letras de control, + sufijo opcional). */
export function validarCUPS(cups: string): boolean {
  const limpio = cups.trim().toUpperCase();
  return /^ES\d{16}[A-Z]{2}([0-9][A-Z])?$/.test(limpio);
}

/**
 * Código postal español: 5 dígitos, y los dos primeros son la provincia
 * (01-52). Que corresponda además a la isla elegida se comprueba aparte,
 * en desajusteCodigoPostal (@/lib/islas).
 */
export function validarCodigoPostal(cp: string): boolean {
  const limpio = cp.trim();
  if (!/^\d{5}$/.test(limpio)) return false;
  const provincia = parseInt(limpio.slice(0, 2), 10);
  return provincia >= 1 && provincia <= 52;
}
