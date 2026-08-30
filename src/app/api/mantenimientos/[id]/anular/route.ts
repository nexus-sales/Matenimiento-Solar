import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import { intervenciones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirAdmin } from "@/lib/permisos";
import { ALMACENAMIENTO_CONFIGURADO, borrarFoto } from "@/lib/almacenamiento";

const esquema = z.object({
  motivo: z
    .string()
    .trim()
    .min(10, "Explica el motivo: quedará escrito en el histórico.")
    .max(500),
  /** Si se programa la que la sustituye, y para qué fecha. */
  rehacer: z.boolean().optional(),
  fechaPrevista: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * Anula una visita firmada.
 *
 * NO la borra ni la edita. Una visita firmada no cambia de contenido nunca:
 * eso es lo que hace que su acta valga algo. Lo que se hace es marcarla como
 * anulada, dejando escrito quién y por qué, y programar otra.
 *
 * Borrarla habría sido más simple, pero dejaría un hueco sin explicación en
 * el histórico del cliente — y el acta anulada quizá ya se le envió.
 *
 * Solo administración: es una corrección sobre un documento firmado.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const denegado = exigirAdmin(sesion);
  if (denegado) return denegado;

  const { id } = await params;
  const parseo = esquema.safeParse(await req.json());
  if (!parseo.success) {
    return NextResponse.json(
      {
        error:
          parseo.error.issues[0]?.message ?? "Datos de anulación inválidos.",
      },
      { status: 400 }
    );
  }

  const { motivo, rehacer, fechaPrevista } = parseo.data;

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select()
      .from(intervenciones)
      .where(eq(intervenciones.id, id))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };

    if (!visita.firmado) {
      return {
        error:
          "Esta visita no está firmada: no hay nada que anular. Se puede editar o borrar directamente.",
        estado: 409,
      };
    }

    if (visita.anulada) {
      return { error: "Esta visita ya estaba anulada.", estado: 409 };
    }

    // La sustituta hereda cliente, tipo y técnico: se anuló por un error de
    // procedimiento, no porque los datos estuvieran mal.
    let nueva: typeof visita | null = null;
    if (rehacer) {
      const hoy = new Date();
      const fecha =
        fechaPrevista ??
        `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

      [nueva] = await tx
        .insert(intervenciones)
        .values({
          clienteId: visita.clienteId,
          tecnicoId: visita.tecnicoId,
          tipo: visita.tipo,
          fechaPrevista: fecha,
        })
        .returning();
    }

    const [anulada] = await tx
      .update(intervenciones)
      .set({
        anulada: true,
        anuladaEn: new Date(),
        // PENDIENTE DE UI: anuladaPor y sustituidaPor se guardan y no los
        // lee ninguna pantalla ni el PDF. El rastro existe en la base y
        // nadie puede verlo, que es justo lo que hacia util la anulacion.
        // Anotado en "Que falta" del README.
        anuladaPor: sesion.id,
        motivoAnulacion: motivo,
        sustituidaPor: nueva?.id ?? null,
      })
      .where(eq(intervenciones.id, id))
      .returning();

    return { anulada, nueva };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  // El acta guardada no lleva el sello de anulada: se borra para que la
  // siguiente descarga la regenere marcada.
  if (ALMACENAMIENTO_CONFIGURADO) {
    try {
      await borrarFoto(`visitas/${id}/informe.pdf`);
    } catch {
      // No existía: nada que invalidar.
    }
  }

  return NextResponse.json({
    anulada: resultado.anulada,
    nueva: resultado.nueva ?? null,
  });
}
