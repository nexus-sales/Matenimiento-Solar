-- Campos nuevos de la ficha de cliente, y la cuarta plantilla.
--
-- SOBRE EL ADD VALUE DEL ENUM, que es la parte delicada:
--
-- PostgreSQL 12 y posteriores SI permiten `ALTER TYPE ... ADD VALUE` dentro de
-- una transaccion -que es como las aplica scripts/aplicar-esquema.mjs-, pero
-- el valor nuevo NO se puede usar hasta que esa transaccion haya hecho commit.
--
-- Aqui no se usa: la migracion solo lo anade. La siembra de los campos de
-- `punto_recarga` ocurre despues, en el paso 4 del script y fuera de esta
-- transaccion, asi que para entonces el valor ya existe.
--
-- Si algun dia alguien mete un INSERT con 'punto_recarga' en este mismo
-- archivo, fallara. No es un fallo del script.

ALTER TYPE "public"."plantilla" ADD VALUE 'punto_recarga';--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "email_planta" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "proveedor" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "fecha_instalacion" date;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "latitud" numeric;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "longitud" numeric;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "periodicidad_mantenimiento" integer;