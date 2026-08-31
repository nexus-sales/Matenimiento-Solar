import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import {
  respuestas,
  observacionesBloque,
  intervenciones,
  plantillaCampo,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { esquemaEstadoPunto } from "@/lib/checklist";

/**
 * Un campo se responde con un estado (checklist de mantenimiento), con un
 * valor (texto, medida, numero, si/no, lista) o solo con fotos. Los tres
 * campos son opcionales por eso, y lo que NO viene no se toca: mandar
 * `observacion` sin `valor` no debe borrar el valor ya escrito.
 */
const esquemaRespuesta = z.object({
  itemId: z.string().uuid(),
  estado: esquemaEstadoPunto.optional(),
  valor: z.string().max(2000).optional().nullable(),
  observacion: z.string().max(2000).optional().nullable(),
});

// El bloque dejo de ser un enum: cada plantilla trae los suyos y el
// administrador podra crear mas. Se valida que sea una clave razonable, no
// que este en una lista cerrada.
const esquemaBloque = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/, "Clave de bloque invalida.");

const esquemaObservacionBloque = z.object({
  categoria: esquemaBloque,
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

  const { itemId } = parseo.data;

  // Distinguir "no viene" de "viene vacio": lo primero deja el dato como
  // estaba, lo segundo lo borra a proposito. Sin esta distincion, guardar la
  // observacion de un campo borraria su valor, y al reves.
  const cambios: {
    estado?: (typeof parseo.data)["estado"];
    valor?: string | null;
    observacion?: string | null;
  } = {};
  if (parseo.data.estado !== undefined) cambios.estado = parseo.data.estado;
  if (parseo.data.valor !== undefined) {
    cambios.valor = parseo.data.valor?.trim() || null;
  }
  if (parseo.data.observacion !== undefined) {
    cambios.observacion = parseo.data.observacion?.trim() || null;
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json(
      { error: "No hay nada que guardar." },
      { status: 400 }
    );
  }

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
      .select({
        firmado: intervenciones.firmado,
        plantilla: intervenciones.plantilla,
      })
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

    // El campo tiene que ser de la plantilla de ESTA intervención y estar
    // activo. Sin esta comprobación bastaba con un UUID válido: se podía
    // colgar una respuesta de un campo del acta de obra en una visita de
    // mantenimiento, y quedaba invisible en pantalla y en el PDF pero
    // presente en el histórico.
    const [campo] = await tx
      .select({ id: plantillaCampo.id })
      .from(plantillaCampo)
      .where(
        and(
          eq(plantillaCampo.id, itemId),
          eq(plantillaCampo.plantilla, visita.plantilla),
          eq(plantillaCampo.activo, true)
        )
      )
      .limit(1);

    if (!campo) {
      return {
        error: "Ese campo no pertenece al formulario de esta visita.",
        estado: 400 as const,
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
        .set(cambios)
        .where(eq(respuestas.id, existente.id))
        .returning();
      return { fila };
    }

    const [fila] = await tx
      .insert(respuestas)
      .values({ intervencionId, campoId: itemId, ...cambios })
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
      .select({
        firmado: intervenciones.firmado,
        plantilla: intervenciones.plantilla,
      })
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
