import { existsSync, readFileSync } from "node:fs";

/**
 * Carga .env.local para procesos que no son el servidor de Next (scripts
 * y drizzle-kit, que no lo leen por su cuenta).
 *
 * A diferencia de process.loadEnvFile, lo que ya esté definido en el
 * entorno NO se sobrescribe. Importa: `npm run db:preparar` lanza la
 * migración con una conexión de superusuario en DATABASE_URL, y si el
 * fichero la pisara con la de app_user la migración fallaría por falta de
 * permisos para crear tablas.
 */
export function cargarEnvLocal() {
  for (const archivo of [".env.local", ".env"]) {
    if (!existsSync(archivo)) continue;

    const contenido = readFileSync(archivo, "utf8");

    for (const linea of contenido.split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;

      const separador = limpia.indexOf("=");
      if (separador === -1) continue;

      const nombre = limpia.slice(0, separador).trim();
      if (process.env[nombre] !== undefined) continue;

      let valor = limpia.slice(separador + 1).trim();
      const entrecomillado =
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"));
      if (entrecomillado) valor = valor.slice(1, -1);

      process.env[nombre] = valor;
    }
    return archivo;
  }
  return null;
}
