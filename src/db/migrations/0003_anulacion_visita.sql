ALTER TABLE "mantenimientos" ADD COLUMN "anulada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD COLUMN "anulada_en" timestamp;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD COLUMN "anulada_por" uuid;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD COLUMN "sustituida_por" uuid;--> statement-breakpoint
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_anulada_por_usuarios_id_fk" FOREIGN KEY ("anulada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;