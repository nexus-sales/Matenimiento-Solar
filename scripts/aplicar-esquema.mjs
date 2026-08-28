/**
 * Crea el esquema en una base de datos que YA EXISTE, con sus roles YA
 * CREADOS. Pensado para ejecutarse dentro del contenedor de la aplicación:
 *
 *   docker exec -e DATABASE_URL_ADMIN='postgresql://...' <app> \
 *     node scripts/aplicar-esquema.mjs
 *
 * Hace cuatro cosas, en este orden:
 *   1. Aplica las migraciones (tablas, tipos, índices)
 *   2. Concede permisos a los dos roles de la aplicación
 *   3. Aplica las políticas de Row Level Security
 *   4. Siembra el catálogo del checklist y el primer administrador
 *
 * Por qué existe, teniendo `db:preparar`:
 *
 * - `db:preparar` CREA la base y los roles, y al encontrarlos ya creados les
 *   asigna contraseña nueva. En el servidor eso invalidaría las URLs que ya
 *   están puestas en el panel. Este script no toca roles ni contraseñas.
 *
 * - `db:preparar` se apoya en drizzle-kit y tsx, que son dependencias de
 *   desarrollo y pueden no estar en la imagen de producción. Este usa solo
 *   `pg` y `bcryptjs`, que son de producción, y corre con `node` a secas.
 *
 * Es idempotente: si el esquema ya está aplicado, lo dice y no duplica nada.
 *
 * Variables:
 *   DATABASE_URL_ADMIN   conexión con permisos para crear tablas (obligatoria)
 *   ROL_APP              rol de la aplicación      (mantsolar_app)
 *   ROL_AUTH             rol del login             (mantsolar_auth)
 *   SEED_ADMIN_EMAIL     correo del primer admin   (admin@sr-energia.local)
 *   SEED_ADMIN_PASSWORD  su contraseña             (se genera si falta)
 *   SIMULAR=si           solo informa del estado, no modifica nada
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const ROL_APP = process.env.ROL_APP || "mantsolar_app";
const ROL_AUTH = process.env.ROL_AUTH || "mantsolar_auth";
const SIMULAR = process.env.SIMULAR === "si";

const paso = (t) => console.log(`\n\x1b[1m→ ${t}\x1b[0m`);
const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const aviso = (t) => console.log(`  \x1b[33m!\x1b[0m ${t}`);

const cadena = process.env.DATABASE_URL_ADMIN;
if (!cadena) {
  console.error(
    "\nFalta DATABASE_URL_ADMIN.\n\n" +
      "Tiene que ser una conexión con permisos para crear tablas — la del\n" +
      "superusuario apuntando a la base de esta aplicación. La conexión\n" +
      "normal de la app (DATABASE_URL) no sirve: su rol no puede crear nada,\n" +
      "y es justo lo que se busca el resto del tiempo.\n"
  );
  process.exit(1);
}

/** Los .sql viven en el repositorio; si la imagen no los trae, no hay nada que aplicar. */
function leerMigraciones() {
  const dir = path.join("src", "db", "migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ nombre: f, sql: readFileSync(path.join(dir, f), "utf8") }));
}

const cliente = new pg.Client({ connectionString: cadena });

try {
  await cliente.connect();
  const { rows: [v] } = await cliente.query("SELECT current_database() bd, version()");
  console.log(`\n\x1b[1mAplicar esquema — SR Energía\x1b[0m`);
  console.log(`  base: ${v.bd}`);
  if (SIMULAR) aviso("MODO SIMULACIÓN: no se modifica nada");

  // --- guardián: la conexión tiene que poder crear tablas ------------
  //
  // Si no puede, además de fallar más adelante, los conteos de abajo
  // MIENTEN: un rol sujeto a RLS ve cero filas donde hay veinticuatro, y el
  // script informaría de que hay que sembrar algo que ya está sembrado.
  // Vale más parar aquí con un mensaje claro.
  const { rows: [priv] } = await cliente.query(`
    select current_user as rol,
           coalesce((select rolsuper from pg_roles where rolname = current_user), false) as superusuario,
           has_schema_privilege(current_user, 'public', 'CREATE') as puede_crear
  `);
  if (!priv.superusuario && !priv.puede_crear) {
    // Sin este guardián el script no solo fallaría más adelante: los
    // conteos de abajo mentirían, porque un rol sujeto a RLS ve cero
    // filas donde hay veinticuatro.
    console.error("");
    console.error(`El rol "${priv.rol}" no puede crear tablas.`);
    console.error("");
    console.error("DATABASE_URL_ADMIN tiene que ser la conexión del");
    console.error("superusuario apuntando a la base de esta aplicación,");
    console.error("no la conexión normal de la app: su rol está limitado");
    console.error("a propósito y no puede crear nada.");
    console.error("");
    process.exit(1);
  }
  ok(`Conectado como ${priv.rol}${priv.superusuario ? " (superusuario)" : ""}`);

  // --- estado actual -------------------------------------------------
  const { rows: [t] } = await cliente.query(
    "select count(*)::int n from pg_tables where schemaname='public'"
  );
  console.log(`  tablas existentes: ${t.n}`);

  for (const rol of [ROL_APP, ROL_AUTH]) {
    const { rowCount } = await cliente.query(
      "select 1 from pg_roles where rolname = $1",
      [rol]
    );
    if (!rowCount) {
      console.error(
        `\nEl rol "${rol}" no existe. Créalo antes, o indica el nombre` +
          ` correcto en ROL_APP / ROL_AUTH.\n`
      );
      process.exit(1);
    }
  }
  ok(`Roles ${ROL_APP} y ${ROL_AUTH} presentes`);

  // --- 1. migraciones -------------------------------------------------
  paso("Migraciones");
  const migraciones = leerMigraciones();
  if (!migraciones.length) {
    console.error(
      "  No hay archivos .sql en src/db/migrations.\n" +
        "  La imagen de producción no los incluye: hay que aplicar el esquema\n" +
        "  por otra vía (por ejemplo, pegándolo en Adminer).\n"
    );
    process.exit(1);
  }

  if (t.n > 0) {
    aviso(`Ya hay ${t.n} tablas — se omiten las migraciones`);
  } else if (SIMULAR) {
    aviso(`Se aplicarían ${migraciones.length} migración(es)`);
  } else {
    for (const m of migraciones) {
      // Drizzle separa las sentencias con este marcador.
      const sentencias = m.sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of sentencias) await cliente.query(s);
      ok(`${m.nombre} — ${sentencias.length} sentencias`);
    }
  }

  // --- 2. permisos ----------------------------------------------------
  paso("Permisos");
  if (SIMULAR) {
    aviso("Se concederían los permisos de los dos roles");
  } else {
    // Las tablas las posee quien las crea. La aplicación NO debe ser la
    // dueña de lo que quiere proteger: el propietario se salta sus propias
    // políticas RLS.
    await cliente.query(`
      GRANT USAGE ON SCHEMA public TO ${ROL_APP}, ${ROL_AUTH};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROL_APP};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROL_APP};
    `);
    ok(`${ROL_APP}: lectura y escritura, sujeto a RLS`);

    // Toda la superficie del único rol que se salta RLS: seis columnas de
    // una tabla, solo lectura. `nombre` entra porque la sesión lo muestra.
    await cliente.query(
      `GRANT SELECT (id, email, nombre, password_hash, rol, activo)
       ON usuarios TO ${ROL_AUTH}`
    );
    ok(`${ROL_AUTH}: 6 columnas de 'usuarios', solo lectura`);
  }

  // --- 3. RLS ---------------------------------------------------------
  paso("Políticas de seguridad");
  const { rows: [p] } = await cliente.query(
    "select count(*)::int n from pg_policies where schemaname='public'"
  );
  if (p.n > 0) {
    aviso(`Ya hay ${p.n} políticas — se omite`);
  } else if (SIMULAR) {
    aviso("Se aplicaría src/db/rls.sql");
  } else {
    await cliente.query(readFileSync(path.join("src", "db", "rls.sql"), "utf8"));
    const { rows: [d] } = await cliente.query(
      "select count(*)::int n from pg_policies where schemaname='public'"
    );
    ok(`${d.n} políticas aplicadas`);
  }

  // --- 4. datos iniciales ---------------------------------------------
  paso("Datos iniciales");
  const items = JSON.parse(
    readFileSync(path.join("src", "db", "checklist-items.json"), "utf8")
  );

  // Simulando sobre una base vacía, las tablas no existen todavía: no se
  // las puede consultar. En la ejecución real sí existen, porque el paso 1
  // ya las ha creado.
  if (SIMULAR && t.n === 0) {
    aviso(`Se sembrarían ${items.length} puntos de checklist`);
    aviso("Se crearía el primer administrador");
    console.log("");
    console.log("Simulación terminada. Nada se ha modificado.");
    console.log("");
    await cliente.end();
    process.exit(0);
  }

  const { rows: [c] } = await cliente.query(
    "select count(*)::int n from checklist_item_definicion"
  );
  if (c.n > 0) {
    aviso(`El catálogo ya tiene ${c.n} puntos — se omite`);
  } else if (SIMULAR) {
    aviso(`Se sembrarían ${items.length} puntos de checklist`);
  } else {
    for (const i of items) {
      await cliente.query(
        `insert into checklist_item_definicion
           (categoria, nombre, periodicidad_meses, orden)
         values ($1, $2, $3, $4)`,
        [i.categoria, i.nombre, i.periodicidadMeses, i.orden]
      );
    }
    ok(`${items.length} puntos de checklist sembrados`);
  }

  const { rows: [u] } = await cliente.query(
    "select count(*)::int n from usuarios where rol = 'admin'"
  );
  if (u.n > 0) {
    aviso("Ya existe un administrador — se omite");
  } else if (SIMULAR) {
    aviso("Se crearía el primer administrador");
  } else {
    const email = process.env.SEED_ADMIN_EMAIL || "admin@sr-energia.local";
    const password =
      process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
    await cliente.query(
      `insert into usuarios (nombre, email, password_hash, rol, activo)
       values ($1, $2, $3, 'admin', true)`,
      ["Administrador", email, await bcrypt.hash(password, 12)]
    );
    console.log("\n  " + "-".repeat(58));
    console.log("  Administrador creado. Guarda estos datos:");
    console.log(`    Email:      ${email}`);
    console.log(`    Contraseña: ${password}`);
    console.log("  " + "-".repeat(58));
  }

  console.log(
    SIMULAR
      ? "\n\x1b[33mSimulación terminada. Nada se ha modificado.\x1b[0m\n"
      : "\n\x1b[32m\x1b[1m✓ Esquema aplicado. La aplicación ya puede funcionar.\x1b[0m\n"
  );
} catch (err) {
  console.error(`\n\x1b[31mError:\x1b[0m ${err.message}`);
  if (err.code === "28P01") console.error("  Credenciales incorrectas.");
  if (err.code === "3D000") console.error("  Esa base de datos no existe.");
  if (err.code === "42501") {
    console.error(
      "  Permiso denegado: DATABASE_URL_ADMIN necesita poder crear tablas."
    );
  }
  process.exit(1);
} finally {
  try {
    await cliente.end();
  } catch {
    // La conexión ya estaba cerrada.
  }
}
