import { z } from "zod";
import { ISLAS_CANARIAS, desajusteCodigoPostal, provinciaDeIsla } from "@/lib/islas";
import {
  validarCUPS,
  validarCodigoPostal,
  validarDocumento,
} from "@/lib/validacion";

/**
 * Un desplegable manda "" cuando el usuario no elige nada, y un input de
 * texto vacío manda "". En ambos casos significa "sin dato", no "valor
 * inválido": se aceptan aquí y se convierten a null antes de guardar.
 */
const vacioComoNulo = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

const numeroOpcional = z
  .union([z.coerce.number().positive(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined || v === null ? null : v));

export const campoIsla = z
  .union([z.enum(ISLAS_CANARIAS), z.literal("")])
  .nullable()
  .optional()
  .transform((v) => v || null);

/**
 * Ficha completa de cliente. Es la única definición de qué es un cliente
 * válido: la usan tanto el alta como la edición, así que no pueden
 * divergir. Refleja el formulario de mantenimiento acordado con SR Energía.
 */
export const esquemaCliente = z
  .object({
    // --- Alta ---
    fechaAlta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de alta inválida.")
      .optional(),

    // --- Identificación y contacto ---
    nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
    documento: z
      .string()
      .transform((v) => v.trim().toUpperCase())
      .refine(
        validarDocumento,
        "Documento inválido: revisa el formato y la letra de control."
      ),
    direccion: vacioComoNulo,
    poblacion: vacioComoNulo,
    codigoPostal: z
      .union([
        z
          .string()
          .trim()
          .refine(validarCodigoPostal, "El código postal debe tener 5 dígitos."),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => v || null),
    isla: campoIsla,
    email: z
      .union([z.string().trim().email("Correo electrónico inválido."), z.literal(""), z.null()])
      .optional()
      .transform((v) => v || null),
    telefono: vacioComoNulo,

    // --- Instalación fotovoltaica ---
    cups: z
      .union([
        z
          .string()
          .transform((v) => v.trim().toUpperCase())
          .refine(
            validarCUPS,
            "El CUPS no tiene un formato válido (ES + 16 dígitos + 2 letras)."
          ),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => v || null),
    potenciaContratada: numeroOpcional,
    potenciaNominal: numeroOpcional,
    marcaInversor: vacioComoNulo,
    numeroInversor: vacioComoNulo,
    comercializadora: vacioComoNulo,
    tieneBateria: z.boolean().optional(),

    // --- Servicio ---
    tieneMantenimiento: z.boolean().optional(),
    comentarios: vacioComoNulo,
  })
  // Un 38xxx en Lanzarote es casi siempre un error de tecleo. Se comprueba
  // aquí, con la ficha entera delante, porque depende de dos campos.
  .superRefine((d, ctx) => {
    const desajuste = desajusteCodigoPostal(d.codigoPostal, d.isla);
    if (desajuste) {
      ctx.addIssue({
        code: "custom",
        path: ["codigoPostal"],
        message: desajuste,
      });
    }
  });

export type DatosCliente = z.infer<typeof esquemaCliente>;

/** La edición reutiliza la misma ficha: se envía completa, no por partes. */
export const esquemaClienteEdicion = esquemaCliente;

/**
 * Traduce la ficha validada a la forma que espera la tabla `clientes`.
 * La provincia no viaja desde el formulario: se deriva de la isla, que es
 * la única fuente de verdad.
 */
export function valoresCliente(d: DatosCliente) {
  return {
    ...(d.fechaAlta ? { fechaAlta: d.fechaAlta } : {}),
    nombre: d.nombre,
    documento: d.documento,
    direccion: d.direccion,
    poblacion: d.poblacion,
    codigoPostal: d.codigoPostal,
    isla: d.isla,
    provincia: provinciaDeIsla(d.isla),
    email: d.email,
    telefono: d.telefono,
    cups: d.cups,
    potenciaContratada: d.potenciaContratada?.toString() ?? null,
    potenciaNominal: d.potenciaNominal?.toString() ?? null,
    marcaInversor: d.marcaInversor,
    numeroInversor: d.numeroInversor,
    comercializadora: d.comercializadora,
    tieneBateria: d.tieneBateria ?? false,
    tieneMantenimiento: d.tieneMantenimiento ?? false,
    comentarios: d.comentarios,
  };
}
