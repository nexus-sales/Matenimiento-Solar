import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import {
  respuestas,
  observacionesBloque,
  intervenciones,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { esquemaCategoria, esquemaEstadoPunto } from "@/lib/checklist";

const esquemaRespuesta = z.object({
  itemId: z.string().uuid(),
  estado: esquemaEstadoPunto,
  observacion: z.string().max(2000).optional().nullable(),
});

const esquemaObservacionBloque = z.object({
  categoria: esquemaCategoria,
  observacion: z.string().max(2000).optional().nullable(),
});

/**
 * Guarda un punto del checklist o la observación de un bloque entero.
 * El cuerpo lleva `itemId` para un punto y `categoria` para un bloque.
 *
 * Se guarda punto a punto según el técnico avanza: en una cubierta, con
 * cobertura mala, perder media hora de trabajo por no haber pulsado
 * "guardar" al final no es aceptable.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id: intervencionId } = await params;
  const body = await req.json();

  if ("categoria" in body) {
    return guardarObservacionBloque(sesion, intervencionId, body);
  }

  const parseo = esquemaRespuesta.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos de checklist inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { itemId, estado, observacion } = parseo.data;
  const texto = observacion?.trim() || null;

  // AQUÍ NO se exige la observación de una incidencia, aunque parezca lo
  // lógico. El técnico marca "incidencia" y DESPUÉS escribe lo que ha visto:
  // rechazar el primer paso hacía imposible llegar al segundo, porque el
  // cuadro de texto solo aparece una vez marcada la incidencia.
  //
  // La exigencia vive donde importa: al firmar (ver .../firma/route.ts). Un
  // punto a medias mientras se trabaja es normal; un acta firmada con una
  // incidencia sin explicar, no.

  const guardado = await conSesionRLS(sesion, async (tx) => {
    // Una visita ya firmada no se retoca: el informe firmado por el cliente
    // y lo que hay en la base tienen que decir lo mismo.
    const [visita] = await tx
      .select({ firmado: intervenciones.firmado })
      .from(intervenciones)
      .where(eq(intervenciones.id, intervencionId))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };
    if (visita.firmado) {
      return {
        error: "La visita ya está firmada y no admite cambios.",
        estado: 409,
      };
    }

    const [existente] = await tx
      .select()
      .from(respuestas)
      .where(
        and(
          eq(respuestas.intervencionId, intervencionId),
          eq(respuestas.campoId, itemId)
        )
      )
      .limit(1);

    if (existente) {
      const [fila] = await tx
        .update(respuestas)
        .set({ estado, observacion: texto })
        .where(eq(respuestas.id, existente.id))
        .returning();
      return { fila };
    }

    const [fila] = await tx
      .insert(respuestas)
      .values({ intervencionId, campoId: itemId, estado, observacion: texto })
      .returning();
    return { fila };
  });

  if ("error" in guardado && guardado.error) {
    return NextResponse.json(
      { error: guardado.error },
      { status: guardado.estado }
    );
  }

  return NextResponse.json(guardado.fila);
}

async function guardarObservacionBloque(
  sesion: { id: string; rol: "admin" | "oficina" | "tecnico" },
  intervencionId: string,
  body: unknown
) {
  const parseo = esquemaObservacionBloque.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Observación de bloque inválida.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { categoria, observacion } = parseo.data;
  const texto = observacion?.trim() || null;

  const guardado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select({ firmado: intervenciones.firmado })
      .from(intervenciones)
      .where(eq(intervenciones.id, intervencionId))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };
    if (visita.firmado) {
      return {
        error: "La visita ya está firmada y no admite cambios.",
        estado: 409,
      };
    }

    const [existente] = await tx
      .select()
      .from(observacionesBloque)
      .where(
        and(
          eq(observacionesBloque.intervencionId, intervencionId),
          eq(observacionesBloque.categoria, categoria)
        )
      )
      .limit(1);

    if (existente) {
      const [fila] = await tx
        .update(observacionesBloque)
        .set({ observacion: texto })
        .where(eq(observacionesBloque.id, existente.id))
        .returning();
      return { fila };
    }

    const [fila] = await tx
      .insert(observacionesBloque)
      .values({ intervencionId, categoria, observacion: texto })
      .returning();
    return { fila };
  });

  if ("error" in guardado && guardado.error) {
    return NextResponse.json(
      { error: guardado.error },
      { status: guardado.estado }
    );
  }

  return NextResponse.json(guardado.fila);
}
