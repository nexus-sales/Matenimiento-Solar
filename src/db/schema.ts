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
/**
 * Que se le pide al tecnico en cada campo.
 *
 * `estado` es el del checklist de mantenimiento (correcto/incidencia/no
 * aplica). El resto nacen de los formularios de obra: el acta es sobre todo
 * `foto`, y la visita previa pide `medida` ("6.40 x 3.90"), `numero` (metros
 * de canalizacion) y `lista` (tipo de cubierta).
 */
export const tipoCampoEnum = pgEnum("tipo_campo", [
  "estado",
  "foto",
  "texto",
  "numero",
  "medida",
  "si_no",
  "lista",
]);

export const plantillaEnum = pgEnum("plantilla", [
  "mantenimiento",
  "visita_previa",
  "acta_obra",
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

// ---------- Intervencion: un formulario relleno ----------
//
// Antes se llamaba `mantenimientos` y solo guardaba visitas. Ahora guarda
// cualquiera de los tres formularios -mantenimiento, visita previa y acta de
// finalizacion- porque comparten toda la maquinaria: cliente, tecnico, fotos,
// firmas, inmutabilidad al firmar, PDF y politicas RLS. Duplicarla habria
// obligado a arreglar cada fallo tres veces.
export const intervenciones = pgTable("intervenciones", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => clientes.id, { onDelete: "cascade" }),
  tecnicoId: uuid("tecnico_id").references(() => usuarios.id),
  plantilla: plantillaEnum("plantilla").notNull().default("mantenimiento"),
  /** Solo para mantenimiento: decide que puntos del checklist tocan. */
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

// ---------- Catalogo de campos de cada plantilla (editable) ----------
//
// Antes se llamaba `checklist_item_definicion` y solo describia puntos de
// checklist. Ahora describe CAMPOS: el mantenimiento los tiene homogeneos
// -todos se responden con un estado- pero el acta de obra es sobre todo un
// protocolo fotografico (54 de sus 85 campos son "haz esta foto") y la visita
// previa pide medidas, secciones de cable y metros.
export const plantillaCampo = pgTable("plantilla_campo", {
  id: uuid("id").defaultRandom().primaryKey(),
  plantilla: plantillaEnum("plantilla").notNull().default("mantenimiento"),
  categoria: text("categoria").notNull(),
  nombre: text("nombre").notNull(),
  tipo: tipoCampoEnum("tipo").notNull().default("estado"),

  /** Solo para el checklist de mantenimiento: 6 o 12 meses. */
  periodicidadMeses: integer("periodicidad_meses"),

  /** El acta lo exige de forma explicita: "Obligatorio!". */
  obligatorio: boolean("obligatorio").notNull().default(false),

  /** Para numeros y medidas: mm2, metros, kW. Se muestra junto al valor. */
  unidad: text("unidad"),

  /** Opciones de un desplegable. */
  opciones: text("opciones").array(),

  /** Aclaracion bajo el campo, para lo que no cabe en el nombre. */
  ayuda: text("ayuda"),

  orden: integer("orden").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
});

// ---------- Respuesta a un campo en una intervencion concreta ----------
export const respuestas = pgTable(
  "respuestas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    intervencionId: uuid("intervencion_id")
      .notNull()
      .references(() => intervenciones.id, { onDelete: "cascade" }),
    campoId: uuid("campo_id")
      .notNull()
      .references(() => plantillaCampo.id),

    /** Solo para campos de tipo `estado` (el checklist de mantenimiento). */
    estado: estadoPuntoEnum("estado").notNull().default("sin_revisar"),

    /**
     * Para todo lo demas. Se guarda como texto a proposito: una medida es
     * "6.40 x 3.90" y una seccion "25mm2" - no son numeros, son lo que el
     * tecnico escribio, y forzarlos a un tipo numerico perderia el dato.
     */
    valor: text("valor"),

    observacion: text("observacion"),
  },
  (t) => ({
    unicoPorIntervencion: uniqueIndex("unico_campo_por_intervencion").on(
      t.intervencionId,
      t.campoId
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
    .references(() => respuestas.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  pie: text("pie"),
  orden: integer("orden").notNull().default(0),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// ---------- Observación de un bloque entero ----------
// El técnico puede comentar punto a punto, pero muchas veces lo que tiene
// que decir es del bloque completo ("toda la estructura con óxido en la
// cara sur"). Repetir esa nota en cinco puntos sería ruido en el informe.
export const observacionesBloque = pgTable(
  "observaciones_bloque",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    intervencionId: uuid("intervencion_id")
      .notNull()
      .references(() => intervenciones.id, { onDelete: "cascade" }),
    categoria: text("categoria").notNull(),
    observacion: text("observacion"),
  },
  (t) => ({
    unicoPorBloque: uniqueIndex("unico_bloque_por_intervencion").on(
      t.intervencionId,
      t.categoria
    ),
  })
);

// ---------- Relaciones (para queries anidadas con Drizzle) ----------
export const clientesRelations = relations(clientes, ({ many }) => ({
  intervenciones: many(intervenciones),
}));

export const intervencionesRelations = relations(
  intervenciones,
  ({ one, many }) => ({
    cliente: one(clientes, {
      fields: [intervenciones.clienteId],
      references: [clientes.id],
    }),
    tecnico: one(usuarios, {
      fields: [intervenciones.tecnicoId],
      references: [usuarios.id],
    }),
    respuestas: many(respuestas),
    observacionesBloque: many(observacionesBloque),
  })
);

export const respuestaRelations = relations(
  respuestas,
  ({ one, many }) => ({
    intervencion: one(intervenciones, {
      fields: [respuestas.intervencionId],
      references: [intervenciones.id],
    }),
    campo: one(plantillaCampo, {
      fields: [respuestas.campoId],
      references: [plantillaCampo.id],
    }),
    fotos: many(respuestaFoto),
  })
);

export const respuestaFotoRelations = relations(respuestaFoto, ({ one }) => ({
  respuesta: one(respuestas, {
    fields: [respuestaFoto.respuestaId],
    references: [respuestas.id],
  }),
}));

export const observacionBloqueRelations = relations(
  observacionesBloque,
  ({ one }) => ({
    intervencion: one(intervenciones, {
      fields: [observacionesBloque.intervencionId],
      references: [intervenciones.id],
    }),
  })
);
