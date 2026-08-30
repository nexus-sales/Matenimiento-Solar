-- Generaliza el esquema de "solo mantenimiento" a tres plantillas:
-- mantenimiento, visita previa y acta de finalización de obra.
--
-- ESCRITA A MANO A PROPÓSITO. drizzle-kit no puede distinguir por su cuenta
-- un renombrado de un borrar-y-crear, y pide confirmación interactiva. Una
-- migración generada sin esa confirmación habría podido recrear las tablas
-- y perder los datos de producción. Aquí todo son RENAME: no se destruye ni
-- se copia nada, y las filas existentes siguen donde estaban.

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
ALTER TABLE "mantenimientos" RENAME TO "intervenciones";
--> statement-breakpoint
ALTER TABLE "checklist_item_definicion" RENAME TO "plantilla_campo";
--> statement-breakpoint
ALTER TABLE "mantenimiento_checklist_respuesta" RENAME TO "respuestas";
--> statement-breakpoint
ALTER TABLE "mantenimiento_observacion_bloque" RENAME TO "observaciones_bloque";
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- 2. Columnas de vínculo
-- ---------------------------------------------------------------------
ALTER TABLE "respuestas" RENAME COLUMN "mantenimiento_id" TO "intervencion_id";
--> statement-breakpoint
ALTER TABLE "respuestas" RENAME COLUMN "item_id" TO "campo_id";
--> statement-breakpoint
ALTER TABLE "observaciones_bloque" RENAME COLUMN "mantenimiento_id" TO "intervencion_id";
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- 3. Índices únicos, para que su nombre siga describiendo lo que hacen
-- ---------------------------------------------------------------------
ALTER INDEX "unico_item_por_visita" RENAME TO "unico_campo_por_intervencion";
--> statement-breakpoint
ALTER INDEX "unico_bloque_por_visita" RENAME TO "unico_bloque_por_intervencion";
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- 3b. Claves foraneas
--
-- Renombrar una tabla en PostgreSQL NO renombra sus restricciones: se
-- quedan con el nombre viejo, que ya no describe nada. Se renombran para
-- que sigan siendo legibles y para que coincidan con lo que espera el ORM.
--
-- RENAME CONSTRAINT no toca los datos ni revalida la clave, al contrario
-- que un DROP + ADD. Los nombres de origen estan truncados a 63 caracteres,
-- que es el limite de identificador de PostgreSQL.
-- ---------------------------------------------------------------------
ALTER TABLE "respuestas" RENAME CONSTRAINT
  "mantenimiento_checklist_respuesta_mantenimiento_id_mantenimient"
  TO "respuestas_intervencion_id_intervenciones_id_fk";
--> statement-breakpoint
ALTER TABLE "respuestas" RENAME CONSTRAINT
  "mantenimiento_checklist_respuesta_item_id_checklist_item_defini"
  TO "respuestas_campo_id_plantilla_campo_id_fk";
--> statement-breakpoint
ALTER TABLE "observaciones_bloque" RENAME CONSTRAINT
  "mantenimiento_observacion_bloque_mantenimiento_id_mantenimiento"
  TO "observaciones_bloque_intervencion_id_intervenciones_id_fk";
--> statement-breakpoint
ALTER TABLE "respuesta_foto" RENAME CONSTRAINT
  "respuesta_foto_respuesta_id_mantenimiento_checklist_respuesta_i"
  TO "respuesta_foto_respuesta_id_respuestas_id_fk";
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- 4. Tipo de campo
--
-- El acta de obra es sobre todo un protocolo fotográfico y la visita previa
-- pide medidas y metros, así que un campo ya no se responde solo con un
-- estado. Las filas existentes son todas del checklist de mantenimiento, y
-- el valor por defecto las deja correctamente marcadas como `estado`.
-- ---------------------------------------------------------------------
CREATE TYPE "public"."tipo_campo" AS ENUM('estado', 'foto', 'texto', 'numero', 'medida', 'si_no', 'lista');
--> statement-breakpoint
ALTER TABLE "plantilla_campo" ADD COLUMN "tipo" "tipo_campo" DEFAULT 'estado' NOT NULL;
--> statement-breakpoint
ALTER TABLE "plantilla_campo" ADD COLUMN "obligatorio" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "plantilla_campo" ADD COLUMN "unidad" text;
--> statement-breakpoint
ALTER TABLE "plantilla_campo" ADD COLUMN "opciones" text[];
--> statement-breakpoint
ALTER TABLE "plantilla_campo" ADD COLUMN "ayuda" text;
--> statement-breakpoint

-- La periodicidad solo aplica al checklist de mantenimiento: en un campo de
-- foto del acta no significa nada, así que deja de ser obligatoria.
ALTER TABLE "plantilla_campo" ALTER COLUMN "periodicidad_meses" DROP NOT NULL;
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- 5. Valor de la respuesta
--
-- Se guarda como texto a propósito: una medida es "6.40 x 3.90" y una
-- sección "25mm²". No son números — son lo que el técnico escribió, y
-- forzarlos a un tipo numérico perdería el dato.
-- ---------------------------------------------------------------------
ALTER TABLE "respuestas" ADD COLUMN "valor" text;
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- 6. Qué formulario es cada intervención
--
-- Las existentes son todas de mantenimiento, y el valor por defecto las
-- deja bien sin tener que tocarlas.
-- ---------------------------------------------------------------------
ALTER TABLE "intervenciones" ADD COLUMN "plantilla" "plantilla" DEFAULT 'mantenimiento' NOT NULL;
