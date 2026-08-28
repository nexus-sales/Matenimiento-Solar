import { defineConfig } from "drizzle-kit";
import { cargarEnvLocal } from "./src/lib/cargar-env";

// drizzle-kit no lee .env.local por su cuenta: sin esto, db:generate y
// db:migrate fallan con DATABASE_URL undefined aunque el fichero exista.
cargarEnvLocal();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
