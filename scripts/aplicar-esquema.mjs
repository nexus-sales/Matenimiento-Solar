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
import { createHash, randomBytes } from "node:crypto";
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
  //
  // Se lleva registro de cuáles se han aplicado, en lugar de mirar si hay
  // tablas. La versión anterior omitía TODAS las migraciones en cuanto
  // existía una tabla: la primera se aplicaba y las siguientes nunca, sin
  // avisar. Un esquema que se queda a medias en silencio es peor que uno
  // que falla.
  paso("Migraciones");
  const migraciones = leerMigraciones();
  if (!migraciones.length) {
    console.error("  No hay archivos .sql en src/db/migrations.");
    console.error("  La imagen de producción no los incluye: hay que aplicar");
    console.error("  el esquema por otra vía.");
    process.exit(1);
  }

  if (!SIMULAR) {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS _migraciones (
        nombre text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  let aplicadas = new Set();
  const { rows: hayRegistro } = await cliente.query(
    "select 1 from pg_tables where schemaname='public' and tablename='_migraciones'"
  );
  if (hayRegistro.length) {
    const { rows } = await cliente.query("select nombre from _migraciones");
    aplicadas = new Set(rows.map((r) => r.nombre));
  }

  // La pregunta correcta no es si el registro EXISTE, sino si está vacío
  // teniendo ya esquema. Un registro recién creado y vacío junto a tablas
  // que ya están significa lo mismo que no tener registro: la migración
  // inicial se aplicó antes de que este mecanismo existiera.
  //
  // Se cuentan las tablas del esquema sin contar el propio registro, que no
  // forma parte del modelo.
  const { rows: [reales] } = await cliente.query(
    "select count(*)::int n from pg_tables where schemaname='public' and tablename <> '_migraciones'"
  );

  if (aplicadas.size === 0 && reales.n > 0) {
    // Base con esquema pero sin registro: es una instalación anterior a que
    // este mecanismo existiera. Antes se daba por aplicada SOLO la primera
    // migración y las intermedias quedaban como pendientes; al reintentarlas
    // fallaban, porque su trabajo ya estaba hecho. Es lo que pasó con la
    // 0004 y hubo que arreglarlo a mano contra la base.
    //
    // El script no puede saber hasta dónde llegó ese esquema: hay que
    // decírselo. Parar y preguntar es peor experiencia que adivinar, y mucho
    // mejor que adivinar mal contra una base con datos.
    const hasta = process.env.ASUMIR_APLICADAS_HASTA?.trim();

    if (!hasta) {
      console.error("");
      console.error("  Esta base ya tiene esquema pero no tiene registro de");
      console.error("  migraciones, así que no se sabe cuáles se aplicaron.");
      console.error("");
      console.error("  Indica la última que YA está aplicada y vuelve a lanzar:");
      console.error("");
      for (const m of migraciones) console.error(`    ${m.nombre}`);
      console.error("");
      console.error("    ASUMIR_APLICADAS_HASTA=<nombre> node scripts/aplicar-esquema.mjs");
      console.error("");
      console.error("  Si no estás seguro, mira qué tablas y columnas existen");
      console.error("  antes de decidir. Aplicar de menos deja el esquema a");
      console.error("  medias; aplicar de más falla, pero sin tocar los datos.");
      console.error("");
      process.exit(1);
    }

    const corte = migraciones.findIndex((m) => m.nombre === hasta);
    if (corte === -1) {
      console.error("");
      console.error(`  ASUMIR_APLICADAS_HASTA="${hasta}" no es ninguna de las`);
      console.error("  migraciones del repositorio. Cópiala tal cual, con .sql.");
      console.error("");
      process.exit(1);
    }

    const previas = migraciones.slice(0, corte + 1);
    aplicadas = new Set(previas.map((m) => m.nombre));
    aviso(`Base preexistente: se dan por aplicadas ${previas.length} migraciones, hasta ${hasta}`);
    if (!SIMULAR) {
      for (const m of previas) {
        await cliente.query(
          "insert into _migraciones (nombre) values ($1) on conflict do nothing",
          [m.nombre]
        );
      }
    }
  }


  const pendientes = migraciones.filter((m) => !aplicadas.has(m.nombre));

  if (!pendientes.length) {
    aviso("Sin migraciones pendientes");
  } else if (SIMULAR) {
    for (const m of pendientes) aviso(`Se aplicaría ${m.nombre}`);
  } else {
    for (const m of pendientes) {
      // Cada migración va en su propia transacción. Sin esto, si una
      // sentencia falla a mitad quedan las anteriores aplicadas y nada
      // registrado: la base en un estado que no es ni el viejo ni el nuevo,
      // y el script sin forma de saberlo en la siguiente ejecución.
      // PostgreSQL admite DDL transaccional, así que esto funciona de verdad.
      const sentencias = m.sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      await cliente.query("BEGIN");
      try {
        for (const s of sentencias) await cliente.query(s);
        await cliente.query(
          "insert into _migraciones (nombre) values ($1) on conflict do nothing",
          [m.nombre]
        );
        await cliente.query("COMMIT");
      } catch (err) {
        await cliente.query("ROLLBACK");
        console.error("");
        console.error(`Falló ${m.nombre}: ${err.message}`);
        console.error("Se ha deshecho por completo. La base queda como estaba.");
        console.error("");
        process.exit(1);
      }
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
  //
  // Antes esto se saltaba el paso entero si ya existía alguna política. El
  // efecto era que un cambio en rls.sql NO llegaba nunca a un servidor ya
  // desplegado, y el script lo informaba como "ya hay 15 políticas" — es
  // decir, fallaba en silencio diciendo que todo estaba bien.
  //
  // Ahora se compara el hash del archivo con el del último aplicado. Si
  // cambia, se vuelve a ejecutar entero; rls.sql es idempotente (cada
  // política lleva su DROP ... IF EXISTS delante), así que reaplicarlo es
  // seguro y deja la base exactamente como describe el archivo.
  paso("Políticas de seguridad");
  const sqlRls = readFileSync(path.join("src", "db", "rls.sql"), "utf8");
  const hashRls = createHash("sha256").update(sqlRls).digest("hex").slice(0, 12);
  const claveRls = `rls.sql@${hashRls}`;

  const { rows: [p] } = await cliente.query(
    "select count(*)::int n from pg_policies where schemaname='public'"
  );
  const yaAplicado = aplicadas.has(claveRls);

  if (yaAplicado) {
    aviso(`Sin cambios en rls.sql (${p.n} políticas activas)`);
  } else if (SIMULAR) {
    aviso(
      p.n > 0
        ? `rls.sql ha cambiado — se reaplicaría sobre las ${p.n} políticas actuales`
        : "Se aplicaría src/db/rls.sql"
    );
  } else {
    // En su propia transacción: si una política nueva está mal escrita, se
    // deshacen todas y quedan las de antes, en vez de media tabla sin
    // proteger.
    await cliente.query("BEGIN");
    try {
      await cliente.query(sqlRls);
      await cliente.query(
        "insert into _migraciones (nombre) values ($1) on conflict do nothing",
        [claveRls]
      );
      await cliente.query("COMMIT");
    } catch (err) {
      await cliente.query("ROLLBACK");
      console.error("");
      console.error(`Falló rls.sql: ${err.message}`);
      console.error("Se ha deshecho. Las políticas anteriores siguen activas.");
      console.error("");
      process.exit(1);
    }
    const { rows: [d] } = await cliente.query(
      "select count(*)::int n from pg_policies where schemaname='public'"
    );
    ok(`${d.n} políticas aplicadas (rls.sql ${hashRls})`);
  }

  // --- 4. datos iniciales ---------------------------------------------
  paso("Datos iniciales");
  // Las tres plantillas. Se siembran por separado porque el catalogo de
  // mantenimiento ya existe en las instalaciones antiguas: comprobar solo si
  // la tabla tiene filas daria por sembradas tambien las dos nuevas, que no
  // llegarian nunca y sin un solo aviso.
  const PLANTILLAS = ["mantenimiento", "visita_previa", "acta_obra"];
  const ARCHIVO = {
    mantenimiento: "mantenimiento.json",
    visita_previa: "visita-previa.json",
    acta_obra: "acta-obra.json",
  };
  const campos = Object.fromEntries(
    PLANTILLAS.map((p) => [
      p,
      JSON.parse(
        readFileSync(path.join("src", "db", "plantillas", ARCHIVO[p]), "utf8")
      ),
    ])
  );
  const items = PLANTILLAS.flatMap((p) => campos[p]);

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

  const { rows: yaHay } = await cliente.query(
    "select plantilla, count(*)::int n from plantilla_campo group by plantilla"
  );
  const sembradas = new Map(yaHay.map((r) => [r.plantilla, r.n]));

  for (const plantilla of PLANTILLAS) {
    const lista = campos[plantilla];
    const existentes = sembradas.get(plantilla) || 0;
    if (existentes > 0) {
      aviso(`${plantilla}: ya tiene ${existentes} campos — se omite`);
      continue;
    }
    if (SIMULAR) {
      aviso(`${plantilla}: se sembrarían ${lista.length} campos`);
      continue;
    }
    for (const i of lista) {
      await cliente.query(
        `insert into plantilla_campo
           (plantilla, categoria, nombre, tipo, obligatorio,
            unidad, opciones, ayuda, periodicidad_meses, orden)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          plantilla,
          i.categoria,
          i.nombre,
          i.tipo,
          i.obligatorio,
          i.unidad,
          i.opciones,
          i.ayuda,
          i.periodicidadMeses,
          i.orden,
        ]
      );
    }
    ok(`${plantilla}: ${lista.length} campos sembrados`);
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
