import { existsSync, readFileSync } from "node:fs";

/**
 * Carga .env.local para los procesos que NO son el servidor de Next.
 *
 * Next lee .env.local por su cuenta, pero drizzle-kit y los scripts que
 * corren con tsx no: sin esto, `npm run db:migrate` y `npm run db:seed`
 * fallan con "DATABASE_URL undefined" aunque el .env.local esté bien.
 *
 * Lo que ya esté definido en el entorno NO se sobrescribe: `npm run
 * db:preparar` lanza la migración con una conexión de superusuario, y si
 * el fichero la pisara con la de app_user fallaría por falta de permisos.
 */
export function cargarEnvLocal(): string | null {
  for (const archivo of [".env.local", ".env"]) {
    if (!existsSync(archivo)) continue;

    for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;

      const separador = limpia.indexOf("=");
      if (separador === -1) continue;

      const nombre = limpia.slice(0, separador).trim();
      if (process.env[nombre] !== undefined) continue;

      let valor = limpia.slice(separador + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }
      process.env[nombre] = valor;
    }
    return archivo;
  }
  return null;
}
