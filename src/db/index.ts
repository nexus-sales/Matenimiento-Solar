import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * TLS apagado por defecto, activable por variable de entorno.
 *
 * En el servidor, Postgres suele ser un contenedor en la red privada de
 * Docker, sin TLS: forzarlo devuelve "The server does not support SSL
 * connections" y la app no arranca. Atarlo a NODE_ENV=production sería
 * exactamente ese error.
 *
 *   DATABASE_SSL=require  cifra sin verificar el certificado (autofirmado)
 *   DATABASE_SSL=strict   cifra y exige certificado válido
 *   sin definir           sin TLS — el caso normal en red privada
 */
function resolverSsl(): false | { rejectUnauthorized: boolean } {
  const modo = process.env.DATABASE_SSL?.toLowerCase();
  if (modo === "strict") return { rejectUnauthorized: true };
  if (modo === "true" || modo === "require") return { rejectUnauthorized: false };
  return false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolverSsl(),
});

export const db = drizzle(pool, { schema });

/**
 * Conexión de servicio SOLO para el paso de login.
 * Antes de autenticar no existe todavía un app.current_user_id que las
 * políticas RLS puedan exigir, así que este pool usa un rol de Postgres
 * aparte con BYPASSRLS, limitado por GRANT a leer únicamente lo necesario
 * de `usuarios` (id, email, password_hash, rol, activo) — nunca se usa
 * para nada más. Ver instrucciones de creación del rol en src/db/rls.sql.
 */
const poolAuth = new Pool({
  connectionString: process.env.DATABASE_URL_AUTH_SERVICE,
  ssl: resolverSsl(),
});
export const dbAuthService = drizzle(poolAuth, { schema });

export type SesionUsuario = {
  id: string;
  rol: "admin" | "oficina" | "tecnico";
};

/**
 * Ejecuta `callback` dentro de una transacción con el contexto de sesión
 * que las políticas RLS de src/db/rls.sql esperan encontrar.
 *
 * Esto es lo que en un backend gestionado viene resuelto de fábrica;
 * aquí lo hacemos explícito porque el Postgres lo gestiona el propio VPS.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES_VALIDOS = ["admin", "oficina", "tecnico"] as const;

/**
 * Sin DATABASE_URL, `pg` intenta conectar a un Postgres por defecto y el
 * fallo llega como ECONNREFUSED o "role does not exist": errores que no
 * dicen lo que de verdad pasa, que es que falta configurar el .env.local.
 * Se comprueba aquí, en la primera consulta, y no al cargar el módulo,
 * para no romper el build (que no toca la base de datos).
 */
function exigirConfiguracionDeBaseDeDatos() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta DATABASE_URL en .env.local — la app no tiene base de datos a la " +
        "que conectarse. Copia .env.example a .env.local y rellena la cadena " +
        "de conexión; después ejecuta `npm run db:migrate`, `npm run db:rls` " +
        "y `npm run db:seed`."
    );
  }
}

export async function conSesionRLS<T>(
  sesion: SesionUsuario,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  exigirConfiguracionDeBaseDeDatos();

  // SET LOCAL no admite parámetros preparados ($1, $2...), así que validamos
  // a mano antes de interpolar. sesion viene de nuestro propio JWT firmado,
  // no de un campo que el usuario escriba directamente, pero se valida igual.
  if (!UUID_RE.test(sesion.id)) {
    throw new Error("id de sesión con formato inválido");
  }
  if (!ROLES_VALIDOS.includes(sesion.rol)) {
    throw new Error("rol de sesión inválido");
  }

  return db.transaction(async (tx) => {
    await tx.execute(`SET LOCAL app.current_user_id = '${sesion.id}'`);
    await tx.execute(`SET LOCAL app.current_user_rol = '${sesion.rol}'`);
    return callback(tx as unknown as typeof db);
  });
}
