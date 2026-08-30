-- El bloque de un campo deja de ser un enum cerrado.
--
-- `categoria_checklist` tenia exactamente cinco valores, los del contrato de
-- mantenimiento: paneles, estructura, inversor, cuadros y baterias. La visita
-- previa habla de sombras, canalizacion DC y exteriores; el acta, de anclajes
-- y subcuadros. Ninguno cabe ahi.
--
-- Se podria ampliar el enum, pero eso obliga a una migracion cada vez que un
-- instalador quiera un bloque propio — y el editor de plantillas existe justo
-- para que no haga falta tocar la base. Ademas ALTER TYPE ... ADD VALUE no
-- permite usar el valor nuevo en la misma transaccion, asi que migracion y
-- siembra no podrian ir juntas.
--
-- El precio es perder la validacion en la base. Se compensa en la aplicacion,
-- que es donde de todas formas vive la lista de bloques de cada plantilla.
ALTER TABLE "plantilla_campo"
  ALTER COLUMN "categoria" SET DATA TYPE text USING "categoria"::text;
--> statement-breakpoint
ALTER TABLE "observaciones_bloque"
  ALTER COLUMN "categoria" SET DATA TYPE text USING "categoria"::text;
--> statement-breakpoint

-- Ya no lo usa nadie. Si quedara colgado, el proximo `drizzle-kit generate`
-- lo veria como una diferencia entre esquema y base y volveria a proponerlo.
DROP TYPE "public"."categoria_checklist";
