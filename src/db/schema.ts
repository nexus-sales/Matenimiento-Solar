import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  date,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { ISLAS_CANARIAS, PROVINCIAS_CANARIAS } from "@/lib/islas";

export const rolEnum = pgEnum("rol_usuario", ["admin", "oficina", "tecnico"]);

// Las islas y las provincias no cambian: se fijan como tipo en la propia
// base de datos, no solo en la validación de la API. Así ninguna carga de
// datos futura puede colar una isla inventada.
export const islaEnum = pgEnum("isla", ISLAS_CANARIAS);
export const provinciaEnum = pgEnum("provincia", PROVINCIAS_CANARIAS);

/**
 * Una visita semestral solo recorre los puntos de 6 meses; la anual, los
 * 24. El tipo se fija al programarla y es lo que decide qué ve el técnico.
 */
export const tipoVisitaEnum = pgEnum("tipo_visita", ["semestral", "anual"]);

/**
 * Estado de un punto del checklist.
 *
 * Un booleano no bastaba: mezclaba "revisado y correcto" con "revisado y
 * hay un problema" y con "esta instalación no tiene eso" (los cimientos de
 * la estructura y todo el bloque de baterías llevan "en caso de tenerlos"
 * en el contrato). En un informe que se firma, los tres son distintos, y
 * `sin_revisar` evita además que un punto en blanco parezca correcto.
 */
export const estadoPuntoEnum = pgEnum("estado_punto", [
  "sin_revisar",
  "correcto",
  "incidencia",
  "no_aplica",
]);

/**
 * Qué formulario define cada punto del catálogo. Hoy solo existe el de
 * mantenimiento; el informe de visita previa y el acta de fin de obra
 * entrarán como plantillas nuevas sin tocar las tablas ni migrar datos.
 */
export const plantillaEnum = pgEnum("plantilla", [
  "mantenimiento",
  "visita_previa",
  "acta_obra",
]);

export const categoriaChecklistEnum = pgEnum("categoria_checklist", [
  "paneles",
  "estructura",
  "inversor",
  "cuadros_protecciones",
  "baterias",
]);

// ---------- Usuario ----------
export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // NIF/NIE/CIF. Se guarda porque el técnico firma cada visita y su
  // documento aparece en el acta: sin esto tendría que teclearlo en cada
  // una, siempre el mismo, en un móvil y subido a una cubierta.
  documento: text("documento"),
  rol: rolEnum("rol").notNull().default("tecnico"),
  isla: islaEnum("isla"), // solo aplica a técnicos
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// ---------- Cliente ----------
// Es el núcleo de la aplicación: una ficha de cliente contiene TODOS sus
// datos, incluidos los de su instalación fotovoltaica. Los demás módulos
// (mantenimientos, y más adelante obras nuevas) leen de aquí; no vuelven a
// pedir el CUPS ni la potencia. Un cliente con dos suministros son dos
// fichas, con su CUPS cada una — igual que serían dos filas en el Excel.
export const clientes = pgTable("clientes", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- Alta ---
  fechaAlta: date("fecha_alta")
    .notNull()
    .default(sql`CURRENT_DATE`),

  // --- Identificación y contacto ---
  nombre: text("nombre").notNull(),
  documento: text("documento").notNull().unique(), // NIF / NIE / CIF
  direccion: text("direccion"),
  poblacion: text("poblacion"),
  codigoPostal: text("codigo_postal"),
  isla: islaEnum("isla"),
  // Se calcula a partir de la isla (ver provinciaDeIsla en @/lib/islas);
  // se almacena para que listados y exportaciones la lleven sin recalcular.
  provincia: provinciaEnum("provincia"),
  email: text("email"),
  telefono: text("telefono"),

  // --- Instalación fotovoltaica ---
  cups: text("cups").unique(),
  potenciaContratada: numeric("potencia_contratada"),
  potenciaNominal: numeric("potencia_nominal"),
  marcaInversor: text("marca_inversor"),
  numeroInversor: text("numero_inversor"),
  comercializadora: text("comercializadora"),
  tieneBateria: boolean("tiene_bateria").notNull().default(false),

  // --- Servicio ---
  // Si el cliente tiene contratado el mantenimiento periódico. Es lo que
  // decide si entra en la planificación de visitas.
  tieneMantenimiento: boolean("tiene_mantenimiento").notNull().default(false),
  comentarios: text("comentarios"),

  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// ---------- Mantenimiento (una visita) ----------
export const mantenimientos = pgTable("mantenimientos", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => clientes.id, { onDelete: "cascade" }),
  tecnicoId: uuid("tecnico_id").references(() => usuarios.id),
  tipo: tipoVisitaEnum("tipo").notNull().default("anual"),
  fechaPrevista: date("fecha_prevista").notNull(),
  fechaEjecucion: date("fecha_ejecucion"), // null = pendiente
  contactado: boolean("contactado").notNull().default(false),
  fechaContacto: date("fecha_contacto"),
  viaWhatsapp: boolean("via_whatsapp").notNull().default(false),
  numeroFactura: text("numero_factura"),
  comentariosGenerales: text("comentarios_generales"),
  equiposReemplazados: text("equipos_reemplazados"),
  // --- Conformidad ---
  // Las firmas se guardan como PNG en base64 (data URL) en la propia base:
  // pesan unos 20 KB, van atadas al registro que validan y no dependen del
  // almacenamiento de objetos, que es para las fotos. Quien firma queda
  // identificado por nombre y documento, como en las actas en papel.
  firmaTecnico: text("firma_tecnico"),
  firmanteTecnicoNombre: text("firmante_tecnico_nombre"),
  firmanteTecnicoDocumento: text("firmante_tecnico_documento"),
  firmaCliente: text("firma_cliente"),
  firmanteClienteNombre: text("firmante_cliente_nombre"),
  firmanteClienteDocumento: text("firmante_cliente_documento"),
  firmado: boolean("firmado").notNull().default(false),
  firmadoEn: timestamp("firmado_en"),

  // --- Anulación ---
  // Una visita firmada nunca cambia de contenido. Si se firmó por error, se
  // ANULA: se marca dejando constancia de quién y por qué, y se programa
  // otra. El acta anulada sigue existiendo, con su sello, porque borrarla
  // dejaría un hueco sin explicación en el histórico del cliente.
  anulada: boolean("anulada").notNull().default(false),
  anuladaEn: timestamp("anulada_en"),
  anuladaPor: uuid("anulada_por").references(() => usuarios.id),
  motivoAnulacion: text("motivo_anulacion"),
  // La visita que la sustituye, para poder seguir el rastro.
  sustituidaPor: uuid("sustituida_por"),

  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// ---------- Catálogo de puntos de checklist (editable) ----------
export const checklistItemDefinicion = pgTable("checklist_item_definicion", {
  id: uuid("id").defaultRandom().primaryKey(),
  plantilla: plantillaEnum("plantilla").notNull().default("mantenimiento"),
  categoria: categoriaChecklistEnum("categoria").notNull(),
  nombre: text("nombre").notNull(),
  periodicidadMeses: integer("periodicidad_meses").notNull(), // 6 o 12
  orden: integer("orden").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
});

// ---------- Respuesta de cada punto en una visita concreta ----------
export const mantenimientoChecklistRespuesta = pgTable(
  "mantenimiento_checklist_respuesta",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mantenimientoId: uuid("mantenimiento_id")
      .notNull()
      .references(() => mantenimientos.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => checklistItemDefinicion.id),
    estado: estadoPuntoEnum("estado").notNull().default("sin_revisar"),
    observacion: text("observacion"),
    // Las fotos van en su propia tabla: en obra rara vez basta una sola
    // (un detalle de cerca y el conjunto para situarlo).
  },
  (t) => ({
    unicoPorVisita: uniqueIndex("unico_item_por_visita").on(
      t.mantenimientoId,
      t.itemId
    ),
  })
);

// ---------- Fotos de un punto ----------
// Varias por punto: en obra casi nunca basta una — el detalle de cerca y
// el plano general que lo sitúa. La URL apunta al almacenamiento
// S3-compatible, con la imagen ya comprimida en el móvil antes de subirla.
export const respuestaFoto = pgTable("respuesta_foto", {
  id: uuid("id").defaultRandom().primaryKey(),
  respuestaId: uuid("respuesta_id")
    .notNull()
    .references(() => mantenimientoChecklistRespuesta.id, {
      onDelete: "cascade",
    }),
  url: text("url").notNull(),
  pie: text("pie"),
  orden: integer("orden").notNull().default(0),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// ---------- Observación de un bloque entero ----------
// El técnico puede comentar punto a punto, pero muchas veces lo que tiene
// que decir es del bloque completo ("toda la estructura con óxido en la
// cara sur"). Repetir esa nota en cinco puntos sería ruido en el informe.
export const mantenimientoObservacionBloque = pgTable(
  "mantenimiento_observacion_bloque",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mantenimientoId: uuid("mantenimiento_id")
      .notNull()
      .references(() => mantenimientos.id, { onDelete: "cascade" }),
    categoria: categoriaChecklistEnum("categoria").notNull(),
    observacion: text("observacion"),
  },
  (t) => ({
    unicoPorBloque: uniqueIndex("unico_bloque_por_visita").on(
      t.mantenimientoId,
      t.categoria
    ),
  })
);

// ---------- Relaciones (para queries anidadas con Drizzle) ----------
export const clientesRelations = relations(clientes, ({ many }) => ({
  mantenimientos: many(mantenimientos),
}));

export const mantenimientosRelations = relations(
  mantenimientos,
  ({ one, many }) => ({
    cliente: one(clientes, {
      fields: [mantenimientos.clienteId],
      references: [clientes.id],
    }),
    tecnico: one(usuarios, {
      fields: [mantenimientos.tecnicoId],
      references: [usuarios.id],
    }),
    respuestas: many(mantenimientoChecklistRespuesta),
    observacionesBloque: many(mantenimientoObservacionBloque),
  })
);

export const respuestaRelations = relations(
  mantenimientoChecklistRespuesta,
  ({ one, many }) => ({
    mantenimiento: one(mantenimientos, {
      fields: [mantenimientoChecklistRespuesta.mantenimientoId],
      references: [mantenimientos.id],
    }),
    item: one(checklistItemDefinicion, {
      fields: [mantenimientoChecklistRespuesta.itemId],
      references: [checklistItemDefinicion.id],
    }),
    fotos: many(respuestaFoto),
  })
);

export const respuestaFotoRelations = relations(respuestaFoto, ({ one }) => ({
  respuesta: one(mantenimientoChecklistRespuesta, {
    fields: [respuestaFoto.respuestaId],
    references: [mantenimientoChecklistRespuesta.id],
  }),
}));

export const observacionBloqueRelations = relations(
  mantenimientoObservacionBloque,
  ({ one }) => ({
    mantenimiento: one(mantenimientos, {
      fields: [mantenimientoObservacionBloque.mantenimientoId],
      references: [mantenimientos.id],
    }),
  })
);
