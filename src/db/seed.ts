import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { checklistItemDefinicion, usuarios } from "./schema";
import { hashPassword } from "../lib/password";
import { cargarEnvLocal } from "../lib/cargar-env";

cargarEnvLocal();

/**
 * El seed escribe en tablas protegidas por RLS, así que necesita una
 * conexión que no esté sujeta a ellas: la del propietario de las tablas.
 * `npm run db:preparar` la pasa en DATABASE_URL_SEED sin escribirla nunca
 * en el .env.local. Fuera de ese flujo se cae a la conexión de servicio.
 */
const cadena =
  process.env.DATABASE_URL_SEED || process.env.DATABASE_URL_AUTH_SERVICE;

if (!cadena) {
  console.error(
    "Falta DATABASE_URL_SEED (o DATABASE_URL_AUTH_SERVICE) — no hay a qué " +
      "conectarse. Ejecuta `npm run db:preparar`, que lo hace todo."
  );
  process.exit(1);
}

const dbSeed = drizzle(new Pool({ connectionString: cadena }));

// Catálogo inicial del checklist de mantenimiento: los 24 puntos del
// contrato. Vive en JSON porque lo comparten dos procesos distintos —
// este seed (TypeScript, vía tsx) y scripts/aplicar-esquema.mjs (JavaScript
// a secas, que es lo único que se puede ejecutar dentro del contenedor de
// producción). Un solo origen evita que se desincronicen.
const ITEMS: {
  categoria: "paneles" | "estructura" | "inversor" | "cuadros_protecciones" | "baterias";
  nombre: string;
  periodicidadMeses: number;
  orden: number;
}[] = JSON.parse(
  readFileSync(new URL("./checklist-items.json", import.meta.url), "utf8")
);

async function seed() {
  console.log(`Sembrando ${ITEMS.length} puntos de checklist...`);
  await dbSeed.insert(checklistItemDefinicion).values(ITEMS);
  console.log("Listo.");

  const emailAdmin = process.env.SEED_ADMIN_EMAIL || "admin@sr-energia.local";
  const passwordAdmin =
    process.env.SEED_ADMIN_PASSWORD ||
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  console.log(`Creando usuario admin inicial (${emailAdmin})...`);
  await dbSeed.insert(usuarios).values({
    nombre: "Administrador",
    email: emailAdmin,
    passwordHash: await hashPassword(passwordAdmin),
    rol: "admin",
    activo: true,
  });

  console.log("---------------------------------------------------------");
  console.log("Admin creado. Guarda esta contraseña, no se volverá a mostrar:");
  console.log(`  Email:      ${emailAdmin}`);
  console.log(`  Contraseña: ${passwordAdmin}`);
  console.log("Cámbiala desde la app en cuanto entres por primera vez.");
  console.log("---------------------------------------------------------");

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
