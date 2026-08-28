CREATE TYPE "public"."categoria_checklist" AS ENUM('paneles', 'estructura', 'inversor', 'cuadros_protecciones', 'baterias');--> statement-breakpoint
CREATE TYPE "public"."estado_punto" AS ENUM('sin_revisar', 'correcto', 'incidencia', 'no_aplica');--> statement-breakpoint
CREATE TYPE "public"."isla" AS ENUM('Tenerife', 'Gran Canaria', 'Lanzarote', 'Fuerteventura', 'La Palma', 'La Gomera', 'El Hierro', 'La Graciosa');--> statement-breakpoint
CREATE TYPE "public"."plantilla" AS ENUM('mantenimiento', 'visita_previa', 'acta_obra');--> statement-breakpoint
CREATE TYPE "public"."provincia" AS ENUM('Las Palmas', 'Santa Cruz de Tenerife');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'oficina', 'tecnico');--> statement-breakpoint
CREATE TYPE "public"."tipo_visita" AS ENUM('semestral', 'anual');--> statement-breakpoint
CREATE TABLE "checklist_item_definicion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plantilla" "plantilla" DEFAULT 'mantenimiento' NOT NULL,
	"categoria" "categoria_checklist" NOT NULL,
	"nombre" text NOT NULL,
	"periodicidad_meses" integer NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha_alta" date DEFAULT CURRENT_DATE NOT NULL,
	"nombre" text NOT NULL,
	"documento" text NOT NULL,
	"direccion" text,
	"codigo_postal" text,
	"isla" "isla",
	"provincia" "provincia",
	"email" text,
	"telefono" text,
	"cups" text,
	"potencia_contratada" numeric,
	"potencia_nominal" numeric,
	"marca_inversor" text,
	"numero_inversor" text,
	"comercializadora" text,
	"tiene_bateria" boolean DEFAULT false NOT NULL,
	"tiene_mantenimiento" boolean DEFAULT false NOT NULL,
	"comentarios" text,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_documento_unique" UNIQUE("documento"),
	CONSTRAINT "clientes_cups_unique" UNIQUE("cups")
);
--> statement-breakpoint
CREATE TABLE "mantenimiento_checklist_respuesta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mantenimiento_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"estado" "estado_punto" DEFAULT 'sin_revisar' NOT NULL,
	"observacion" text
);
--> statement-breakpoint
CREATE TABLE "mantenimiento_observacion_bloque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mantenimiento_id" uuid NOT NULL,
	"categoria" "categoria_checklist" NOT NULL,
	"observacion" text
);
--> statement-breakpoint
CREATE TABLE "mantenimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tecnico_id" uuid,
	"tipo" "tipo_visita" DEFAULT 'anual' NOT NULL,
	"fecha_prevista" date NOT NULL,
	"fecha_ejecucion" date,
	"contactado" boolean DEFAULT false NOT NULL,
	"fecha_contacto" date,
	"via_whatsapp" boolean DEFAULT false NOT NULL,
	"numero_factura" text,
	"comentarios_generales" text,
	"equipos_reemplazados" text,
	"firma_tecnico" text,
	"firmante_tecnico_nombre" text,
	"firmante_tecnico_documento" text,
	"firma_cliente" text,
	"firmante_cliente_nombre" text,
	"firmante_cliente_documento" text,
	"firmado" boolean DEFAULT false NOT NULL,
	"firmado_en" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "respuesta_foto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"respuesta_id" uuid NOT NULL,
	"url" text NOT NULL,
	"pie" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol_usuario" DEFAULT 'tecnico' NOT NULL,
	"isla" "isla",
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "mantenimiento_checklist_respuesta" ADD CONSTRAINT "mantenimiento_checklist_respuesta_mantenimiento_id_mantenimientos_id_fk" FOREIGN KEY ("mantenimiento_id") REFERENCES "public"."mantenimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mantenimiento_checklist_respuesta" ADD CONSTRAINT "mantenimiento_checklist_respuesta_item_id_checklist_item_definicion_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."checklist_item_definicion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mantenimiento_observacion_bloque" ADD CONSTRAINT "mantenimiento_observacion_bloque_mantenimiento_id_mantenimientos_id_fk" FOREIGN KEY ("mantenimiento_id") REFERENCES "public"."mantenimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_tecnico_id_usuarios_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respuesta_foto" ADD CONSTRAINT "respuesta_foto_respuesta_id_mantenimiento_checklist_respuesta_id_fk" FOREIGN KEY ("respuesta_id") REFERENCES "public"."mantenimiento_checklist_respuesta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unico_item_por_visita" ON "mantenimiento_checklist_respuesta" USING btree ("mantenimiento_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unico_bloque_por_visita" ON "mantenimiento_observacion_bloque" USING btree ("mantenimiento_id","categoria");