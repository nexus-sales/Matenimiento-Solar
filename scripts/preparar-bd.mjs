/**
 * Prepara la base de datos de cero, en un solo comando:
 *
 *   npm run db:preparar
 *
 * Crea la base, los dos roles con sus permisos, aplica las migraciones y
 * las políticas RLS, y siembra los datos iniciales. Es idempotente.
 *
 * Sirve tanto en local como en el servidor. Lo que cambia se pasa por
 * variables de entorno:
 *
 *   PGHOST      servidor        (por defecto localhost)
 *   PGPORT      puerto          (5432)
 *   PGUSER      superusuario    (postgres · en el servidor, admin_apps)
 *   PGPASSWORD  su contraseña   (si no, se pide por consola)
 *   PGDATABASE  base a la que conectarse para crear la nueva (postgres)
 *   BD_NOMBRE   base a crear    (sr_mantenimiento)
 *
 *   ESCRIBIR_ENV=no   no toca .env.local; imprime las variables para
 *                     copiarlas al panel de Dokploy
 *
 * La contraseña del superusuario no se guarda en ningún sitio.
 *
 * IMPORTANTE — los roles son globales al clúster, no de la base. Por eso
 * llevan prefijo: en un PostgreSQL compartido con otras aplicaciones, un
 * rol llamado `app_user` chocaría con el de cualquiera.
 */
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";

const BD = process.env.BD_NOMBRE || "sr_mantenimiento";
const HOST = process.env.PGHOST || "localhost";
const PUERTO = process.env.PGPORT || "5432";
const SUPERUSUARIO = process.env.PGUSER || "postgres";
const BD_ADMIN = process.env.PGDATABASE || "postgres";
const ESCRIBIR_ENV = process.env.ESCRIBIR_ENV !== "no";

// Prefijados porque los roles son del clúster entero, no de la base.
const ROL_APP = process.env.ROL_APP || "sr_energia_app";
const ROL_AUTH = process.env.ROL_AUTH || "sr_energia_auth";

const paso = (t) => console.log(`\n\x1b[1m→ ${t}\x1b[0m`);
const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const aviso = (t) => console.log(`  \x1b[33m!\x1b[0m ${t}`);

/** Contraseña aleatoria para los roles de la app. No la teclea nadie. */
const clave = () => randomBytes(18).toString("base64url");

function url(usuario, password, base = BD) {
  return `postgresql://${usuario}:${encodeURIComponent(password)}@${HOST}:${PUERTO}/${base}`;
}

async function conectar(usuario, password, base) {
  const cliente = new pg.Client({ connectionString: url(usuario, password, base) });
  await cliente.connect();
  return cliente;
}

async function main() {
  console.log("\n\x1b[1mPreparar la base de datos — SR Energía\x1b[0m");
  console.log(`  destino: ${SUPERUSUARIO}@${HOST}:${PUERTO} → base "${BD}"`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const passSuper =
    process.env.PGPASSWORD ||
    (await rl.question(`\nContraseña del superusuario '${SUPERUSUARIO}': `));
  rl.close();

  if (!passSuper) {
    console.error("\nSin contraseña no se puede continuar.");
    process.exit(1);
  }

  // ---------------------------------------------------------------
  paso("Comprobando la conexión con PostgreSQL");
  let admin;
  try {
    admin = await conectar(SUPERUSUARIO, passSuper, BD_ADMIN);
  } catch (err) {
    console.error(`\n\x1b[31mNo se pudo conectar a PostgreSQL en ${HOST}:${PUERTO}.\x1b[0m`);
    if (err.code === "ECONNREFUSED") {
      console.error(
        "\nEl servicio no está arrancado. Abre PowerShell COMO ADMINISTRADOR y ejecuta:\n" +
          "    net start postgresql-x64-18\n"
      );
    } else if (err.code === "28P01") {
      console.error("\nLa contraseña de 'postgres' no es correcta.\n");
    } else {
      console.error(`\n${err.message}\n`);
    }
    process.exit(1);
  }
  const { rows: [v] } = await admin.query("SELECT version()");
  ok(v.version.split(",")[0]);

  // ---------------------------------------------------------------
  paso("Creando la base de datos y los roles");

  const passApp = clave();
  const passAuth = clave();

  const existeBD = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [BD]);
  if (existeBD.rowCount) {
    aviso(`La base '${BD}' ya existía — se reutiliza`);
  } else {
    await admin.query(`CREATE DATABASE ${BD}`);
    ok(`Base '${BD}' creada`);
  }

  // Los roles se recrean con contraseña nueva en cada preparación: así el
  // .env.local que se escribe abajo siempre concuerda con la base.
  for (const [rol, password, extra] of [
    [ROL_APP, passApp, ""],
    // BYPASSRLS: es la conexión del login, que necesita leer `usuarios`
    // antes de que exista una sesión que las políticas puedan comprobar.
    [ROL_AUTH, passAuth, "BYPASSRLS"],
  ]) {
    const existe = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [rol]);
    if (existe.rowCount) {
      await admin.query(`ALTER ROLE ${rol} WITH LOGIN PASSWORD '${password}' ${extra}`);
      ok(`Rol '${rol}' actualizado`);
    } else {
      await admin.query(`CREATE ROLE ${rol} LOGIN PASSWORD '${password}' ${extra}`);
      ok(`Rol '${rol}' creado`);
    }
  }
  await admin.end();

  // ---------------------------------------------------------------
  paso(ESCRIBIR_ENV ? "Escribiendo .env.local" : "Variables de conexión");

  // AUTH_SECRET se conserva si ya existía: regenerarlo invalidaría las
  // sesiones abiertas sin ninguna razón.
  const previo = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  const secretoPrevio = previo.match(/^AUTH_SECRET=(.+)$/m)?.[1]?.trim();
  const authSecret = secretoPrevio || randomBytes(32).toString("base64");

  const lineas = [
      "# Generado por `npm run db:preparar`. No subir a git.",
      "",
      "# Conexión normal de la app, sujeta a las políticas RLS.",
      `DATABASE_URL=${url(ROL_APP, passApp)}`,
      "",
      "# Conexión de servicio SOLO para el login (rol con BYPASSRLS).",
      `DATABASE_URL_AUTH_SERVICE=${url(ROL_AUTH, passAuth)}`,
      "",
      "# Firma de las cookies de sesión.",
      `AUTH_SECRET=${authSecret}`,
      "",
      "# Modo de pruebas: desactiva el login en local. El id lo rellena",
      "# el propio script tras sembrar el usuario admin.",
      "AUTH_MODO_PRUEBAS=false",
      "MODO_PRUEBAS_USER_ID=",
      "",
  ];

  if (ESCRIBIR_ENV) {
    writeFileSync(".env.local", lineas.join("\n"), "utf8");
    ok(".env.local escrito con las tres variables");
  } else {
    // En el servidor las variables van al panel de Dokploy, no a un
    // archivo: el repositorio no debe contener credenciales.
    console.log("\n  Copia estas variables al panel de Dokploy:\n");
    console.log("  " + "-".repeat(66));
    for (const l of lineas) {
      if (l && !l.startsWith("#")) console.log("  " + l);
    }
    console.log("  " + "-".repeat(66));
    aviso("No se ha tocado .env.local (ESCRIBIR_ENV=no)");
  }

  // ---------------------------------------------------------------
  paso("Aplicando las migraciones");
  const migrar = spawnSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: url(SUPERUSUARIO, passSuper) },
  });
  if (migrar.status !== 0) {
    console.error("\nFalló la migración. Revisa el error de arriba.");
    process.exit(1);
  }
  ok("Tablas creadas");

  // ---------------------------------------------------------------
  paso("Aplicando permisos y políticas RLS");
  const db = await conectar(SUPERUSUARIO, passSuper, BD);

  // Las tablas las crea (y por tanto posee) `postgres`. Es a propósito:
  // el propietario de una tabla se salta sus propias políticas RLS, así
  // que la app NO debe ser la dueña de lo que quiere proteger.
  await db.query(`
    GRANT USAGE ON SCHEMA public TO ${ROL_APP}, ${ROL_AUTH};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROL_APP};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROL_APP};
  `);
  ok(`Permisos de ${ROL_APP} concedidos`);

  // El rol del login solo puede LEER seis columnas de una tabla. Es toda la
  // superficie que tiene la única conexión que se salta RLS. `nombre` entra
  // porque la sesión lo lleva para la barra lateral.
  await db.query(
    `GRANT SELECT (id, email, nombre, password_hash, rol, activo) ON usuarios TO ${ROL_AUTH}`
  );
  ok(`${ROL_AUTH} limitado a 6 columnas de 'usuarios'`);

  const rls = readFileSync("src/db/rls.sql", "utf8");
  try {
    await db.query(rls);
    ok("Políticas RLS aplicadas");
  } catch (err) {
    if (err.code === "42710") {
      aviso("Las políticas RLS ya existían — se dejan como están");
    } else {
      throw err;
    }
  }
  await db.end();

  // ---------------------------------------------------------------
  paso("Sembrando datos iniciales");
  const sembrar = spawnSync("npm", ["run", "db:seed"], {
    stdio: "inherit",
    shell: true,
    // El seed escribe en tablas protegidas por RLS, así que corre como
    // superusuario. La contraseña vive solo en el entorno de este hijo:
    // nunca llega al .env.local.
    env: { ...process.env, DATABASE_URL_SEED: url(SUPERUSUARIO, passSuper) },
  });
  if (sembrar.status !== 0) {
    aviso("El seed falló o ya se había ejecutado. Revisa el mensaje de arriba.");
  }

  // ---------------------------------------------------------------
  // El .env.local anuncia que este id lo rellena el script: se cumple.
  // Se deja escrito aunque el modo de pruebas quede desactivado, para que
  // activarlo sea cambiar una sola palabra y no ir a buscar el uuid.
  paso("Anotando el id del admin para el modo de pruebas");
  const bd = await conectar(SUPERUSUARIO, passSuper, BD);
  const { rows } = await bd.query(
    "select id, email from usuarios where rol = 'admin' order by creado_en limit 1"
  );
  await bd.end();

  if (rows.length && ESCRIBIR_ENV) {
    const env = readFileSync(".env.local", "utf8").replace(
      /^MODO_PRUEBAS_USER_ID=.*$/m,
      `MODO_PRUEBAS_USER_ID=${rows[0].id}`
    );
    writeFileSync(".env.local", env, "utf8");
    ok(`${rows[0].email} → ${rows[0].id}`);
  } else if (rows.length) {
    ok(`admin sembrado: ${rows[0].email}`);
  } else {
    aviso("No se encontró ningún admin: el modo de pruebas queda sin id.");
  }

  console.log("\n\x1b[32m\x1b[1m✓ Base de datos lista.\x1b[0m");
  console.log("\nArranca la app con:  npm run dev");
  console.log("Y entra con el email y la contraseña que ha impreso el seed.\n");
}

main().catch((err) => {
  console.error("\n\x1b[31mError:\x1b[0m", err.message);
  process.exit(1);
});
