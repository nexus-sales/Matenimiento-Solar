/**
 * Aplica src/db/rls.sql sobre la base configurada.
 *
 * Sustituye al `psql $DATABASE_URL -f ...` de antes, que no funcionaba en
 * Windows: psql no queda en el PATH al instalar PostgreSQL, y PowerShell
 * no expande `$DATABASE_URL`. Esto usa el driver `pg`, que ya es
 * dependencia del proyecto, así que funciona igual en cualquier sistema.
 *
 * Las políticas las tiene que crear el propietario de las tablas, no la
 * conexión de la app: pásale una cadena de superusuario en DATABASE_URL_SEED
 * si DATABASE_URL apunta a app_user.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { cargarEnvLocal } from "./cargar-env.mjs";

cargarEnvLocal();

const cadena = process.env.DATABASE_URL_SEED || process.env.DATABASE_URL;

if (!cadena) {
  console.error(
    "Falta DATABASE_URL en .env.local. Ejecuta `npm run db:preparar`, que " +
      "crea la base y lo configura todo."
  );
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: cadena });

try {
  await cliente.connect();
  await cliente.query(readFileSync("src/db/rls.sql", "utf8"));
  console.log("✓ Políticas RLS aplicadas.");
} catch (err) {
  if (err.code === "42710") {
    console.log("! Las políticas ya existían — nada que hacer.");
  } else {
    console.error("Error aplicando RLS:", err.message);
    process.exit(1);
  }
} finally {
  await cliente.end();
}
