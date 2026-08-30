import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { plantillaCampo, usuarios } from "./schema";
import { PLANTILLAS, type Plantilla } from "../lib/plantillas";
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

// Catálogo inicial de las tres plantillas. Vive en JSON porque lo comparten
// dos procesos distintos — este seed (TypeScript, vía tsx) y
// scripts/aplicar-esquema.mjs (JavaScript a secas, que es lo único que se
// puede ejecutar dentro del contenedor de producción). Un solo origen evita
// que se desincronicen.
type CampoSemilla = {
  plantilla: Plantilla;
  categoria: string;
  nombre: string;
  tipo: "estado" | "foto" | "texto" | "numero" | "medida" | "si_no" | "lista";
  obligatorio: boolean;
  unidad: string | null;
  opciones: string[] | null;
  ayuda: string | null;
  periodicidadMeses: number | null;
  orden: number;
};

const ARCHIVO: Record<Plantilla, string> = {
  mantenimiento: "mantenimiento.json",
  visita_previa: "visita-previa.json",
  acta_obra: "acta-obra.json",
};

function campos(plantilla: Plantilla): CampoSemilla[] {
  return JSON.parse(
    readFileSync(
      new URL(`./plantillas/${ARCHIVO[plantilla]}`, import.meta.url),
      "utf8"
    )
  );
}

async function seed() {
  for (const plantilla of PLANTILLAS) {
    const lista = campos(plantilla);
    console.log(`Sembrando ${lista.length} campos de ${plantilla}...`);
    await dbSeed.insert(plantillaCampo).values(lista);
  }
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
