/**
 * Cambia la contraseña de un usuario desde la consola:
 *
 *   npm run db:password
 *   npm run db:password -- otro@correo.com
 *
 * Existe porque el seed imprime la contraseña del primer admin una sola vez.
 * Si se pierde, sin esto no había forma de entrar: no hay recuperación por
 * correo, y crear otro admin exige estar dentro de la aplicación.
 *
 * Pide la contraseña del superusuario `postgres` porque la tabla `usuarios`
 * está protegida por RLS y el rol de la aplicación no puede reescribir
 * contraseñas — que es justo lo que se quiere el resto del tiempo.
 */
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";
import { cargarEnvLocal } from "./cargar-env.mjs";

cargarEnvLocal();

const HOST = process.env.PGHOST || "localhost";
const PUERTO = process.env.PGPORT || "5432";
const BD = "sr_mantenimiento";

const correo = process.argv[2] || "admin@sr-energia.local";

const rl = createInterface({ input: process.stdin, output: process.stdout });

const passSuper =
  process.env.PGPASSWORD ||
  (await rl.question("Contraseña del superusuario 'postgres': "));

const nueva =
  (await rl.question(
    "Nueva contraseña para " + correo + " (Intro = generar una): "
  )) || randomBytes(9).toString("base64url");

rl.close();

if (nueva.length < 8) {
  console.error("\nLa contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const cliente = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(passSuper)}@${HOST}:${PUERTO}/${BD}`,
});

try {
  await cliente.connect();

  // El mismo coste que usa la aplicación al crear usuarios (src/lib/password.ts).
  const hash = await bcrypt.hash(nueva, 12);

  const { rowCount } = await cliente.query(
    "update usuarios set password_hash = $1 where email = $2",
    [hash, correo]
  );

  if (rowCount === 0) {
    console.error(`\nNo hay ningún usuario con el correo "${correo}".`);
    const { rows } = await cliente.query(
      "select email, rol from usuarios order by rol"
    );
    if (rows.length) {
      console.error("\nUsuarios existentes:");
      for (const r of rows) console.error(`  ${r.email}  (${r.rol})`);
    }
    process.exit(1);
  }

  console.log("\n---------------------------------------------------------");
  console.log("Contraseña cambiada.");
  console.log(`  Email:      ${correo}`);
  console.log(`  Contraseña: ${nueva}`);
  console.log("---------------------------------------------------------\n");
} catch (err) {
  if (err.code === "ECONNREFUSED") {
    console.error(
      "\nPostgreSQL no responde. Arranca el servicio y vuelve a intentarlo."
    );
  } else if (err.code === "28P01") {
    console.error("\nLa contraseña de 'postgres' no es correcta.");
  } else {
    console.error("\nError:", err.message);
  }
  process.exit(1);
} finally {
  try {
    await cliente.end();
  } catch {
    // La conexión ya estaba cerrada; no aporta nada informarlo.
  }
}
