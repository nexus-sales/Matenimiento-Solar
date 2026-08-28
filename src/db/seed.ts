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

// Catálogo inicial del checklist de mantenimiento.
// Es un punto de partida editable — un admin puede añadir, desactivar
// o renombrar puntos desde la propia app sin tocar este archivo.
const ITEMS: {
  categoria: "paneles" | "estructura" | "inversor" | "cuadros_protecciones" | "baterias";
  nombre: string;
  periodicidadMeses: 6 | 12;
  orden: number;
}[] = [
  // Módulos / Paneles
  { categoria: "paneles", nombre: "Limpieza de módulos", periodicidadMeses: 6, orden: 1 },
  { categoria: "paneles", nombre: "Diferencias visuales frente a instalación original", periodicidadMeses: 6, orden: 2 },
  { categoria: "paneles", nombre: "Revisión de bornes, conexiones y estado de los diodos", periodicidadMeses: 6, orden: 3 },
  { categoria: "paneles", nombre: "Presencia de daños que afecten a la seguridad", periodicidadMeses: 12, orden: 4 },
  { categoria: "paneles", nombre: "Deformaciones de los paneles", periodicidadMeses: 12, orden: 5 },

  // Estructuras
  { categoria: "estructura", nombre: "Revisión de degradación", periodicidadMeses: 12, orden: 6 },
  { categoria: "estructura", nombre: "Revisión de corrosión", periodicidadMeses: 12, orden: 7 },
  { categoria: "estructura", nombre: "Apriete de tornillos", periodicidadMeses: 12, orden: 8 },
  { categoria: "estructura", nombre: "Revisión de los cimientos (en caso de tenerlos)", periodicidadMeses: 12, orden: 9 },
  { categoria: "estructura", nombre: "Engrase / lubricación en caso de requerirlo", periodicidadMeses: 12, orden: 10 },

  // Equipos electrónicos / Inversor
  { categoria: "inversor", nombre: "Funcionamiento de indicadores, intensidad y caídas de tensión entre terminales", periodicidadMeses: 12, orden: 11 },
  { categoria: "inversor", nombre: "Revisión de cableado y conexión", periodicidadMeses: 12, orden: 12 },
  { categoria: "inversor", nombre: "Revisión de tensión, estado de indicadores y alarmas", periodicidadMeses: 12, orden: 13 },
  { categoria: "inversor", nombre: "Revisión de funcionamiento de contadores y tolerancia de la medida", periodicidadMeses: 12, orden: 14 },
  { categoria: "inversor", nombre: "Revisión de conexión de terminales", periodicidadMeses: 12, orden: 15 },
  { categoria: "inversor", nombre: "Revisión de conexiones remotas, almacenamiento, registros, regulación y tolerancia de la medida", periodicidadMeses: 6, orden: 16 },
  { categoria: "inversor", nombre: "Revisión de sistemas de monitorización y conexión WiFi", periodicidadMeses: 6, orden: 17 },

  // Cuadros, cables, interruptores y protecciones
  { categoria: "cuadros_protecciones", nombre: "Revisión de cableado: estanqueidad, protección y conexión de terminales, empalmes y platinas", periodicidadMeses: 12, orden: 18 },
  { categoria: "cuadros_protecciones", nombre: "Revisión de caída de tensión CC", periodicidadMeses: 12, orden: 19 },
  { categoria: "cuadros_protecciones", nombre: "Revisión de interruptores, funcionamiento y conexión de terminales", periodicidadMeses: 12, orden: 20 },
  { categoria: "cuadros_protecciones", nombre: "Revisión de protecciones y actuación de seguridad: fusibles, tomas de tierra, interruptores de seguridad", periodicidadMeses: 12, orden: 21 },
  { categoria: "cuadros_protecciones", nombre: "Revisión de uniones", periodicidadMeses: 12, orden: 22 },

  // Acumulación / Baterías
  { categoria: "baterias", nombre: "Valorar degradación y desgaste por cargas y descargas", periodicidadMeses: 12, orden: 23 },
  { categoria: "baterias", nombre: "Revisión del BMS: nivel de carga, temperatura interna, vida útil restante del ciclo", periodicidadMeses: 12, orden: 24 },
];

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
