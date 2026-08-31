import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { hashPassword, verificarPassword } from "./password";
import { modoPruebasActivo, idUsuarioPruebas } from "./modo-pruebas";

// Se reexportan para no romper los imports existentes de \"@/lib/auth\".
// La lógica en sí vive en password.ts, que no depende de next/headers,
// para que scripts fuera del runtime de Next (como el seed) puedan usarla.
export { hashPassword, verificarPassword };

const COOKIE_NAME = "sesion";

/**
 * Longitud mínima del secreto de firma.
 *
 * HS256 usa el secreto tal cual como clave HMAC: uno corto se puede romper
 * por fuerza bruta fuera de línea a partir de un solo token, y con él se
 * firman sesiones de administrador. 32 caracteres es lo que genera
 * `openssl rand -base64 32`, que es lo que documenta el .env.example.
 */
const MIN_SECRETO = 32;

function obtenerSecreto(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) {
    throw new Error(
      "Falta AUTH_SECRET en las variables de entorno (mínimo 32 caracteres aleatorios)."
    );
  }
  // Antes solo se comprobaba que existiera: el mensaje exigía 32 caracteres
  // y el código aceptaba uno. Un despliegue con AUTH_SECRET=secreto firmaba
  // sesiones válidas y nadie se enteraba.
  if (secreto.length < MIN_SECRETO) {
    throw new Error(
      `AUTH_SECRET tiene ${secreto.length} caracteres y necesita al menos ` +
        `${MIN_SECRETO}. Con HS256 el secreto ES la clave: uno corto se ` +
        "rompe fuera de línea a partir de un solo token. Genera uno con " +
        "`openssl rand -base64 32`."
    );
  }
  return new TextEncoder().encode(secreto);
}

export type SesionPayload = {
  id: string;
  rol: "admin" | "oficina" | "tecnico";
  nombre: string;
};


export async function crearSesion(payload: SesionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(obtenerSecreto());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function cerrarSesion() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function obtenerSesion(): Promise<SesionPayload | null> {
  if (modoPruebasActivo()) {
    return {
      id: idUsuarioPruebas(),
      rol: "admin",
      nombre: "Usuario de pruebas",
    };
  }

  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const secreto = obtenerSecreto(); // lanza si falta AUTH_SECRET — no silenciar

  try {
    const { payload } = await jwtVerify(token, secreto);
    return payload as unknown as SesionPayload;
  } catch {
    // aquí solo llegan errores de token inválido o caducado

    return null;
  }
}

/**
 * Comprobación de rol a nivel de API, además de RLS en la base de datos.
 * RLS ya impediría la escritura aunque esto no existiera, pero sin esto
 * un técnico recibiría un error crudo de Postgres en vez de un 403 claro.
 */
export function tieneRol(
  sesion: SesionPayload,
  rolesPermitidos: SesionPayload["rol"][]
): boolean {
  return rolesPermitidos.includes(sesion.rol);
}
