-- Fuera latitud y longitud: las sustituye el enlace de Google Maps.
--
-- Se pidio "subir enlace google maps", y un enlace es lo que de verdad se
-- rellena: en el movil se comparte la ubicacion y se pega. Copiar latitud y
-- longitud son tres pasos mas y nadie los da.
--
-- Estas dos columnas se anadieron hoy mismo y ninguna ficha las tiene
-- rellenas. Si alguna las tuviera, ESE DATO SE PIERDE: es un DROP COLUMN y no
-- hay vuelta atras. Se comprueba antes de aplicar con
--
--   SELECT count(*) FROM clientes WHERE latitud IS NOT NULL OR longitud IS NOT NULL;
--
-- Van en dos migraciones y no en una porque drizzle-kit no puede distinguir
-- un renombrado de un borrar-y-crear, y pide confirmacion por consola. Es la
-- misma proteccion que evito que se recrearan las tablas al generalizarlas.

ALTER TABLE "clientes" DROP COLUMN "latitud";--> statement-breakpoint
ALTER TABLE "clientes" DROP COLUMN "longitud";