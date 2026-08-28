import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import {
  clientes,
  mantenimientos,
  mantenimientoChecklistRespuesta,
  mantenimientoObservacionBloque,
  checklistItemDefinicion,
  respuestaFoto,
  usuarios,
} from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirRolEscritura } from "@/lib/permisos";
import { esquemaTipoVisita, itemAplicaAVisita } from "@/lib/checklist";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select()
      .from(mantenimientos)
      .where(eq(mantenimientos.id, id))
      .limit(1);

    if (!visita) return null;

    // La ficha del cliente es la fuente de todo: dirección a la que ir,
    // CUPS, inversor y si tiene batería. El módulo no vuelve a pedirlo.
    const [cliente] = await tx
      .select()
      .from(clientes)
      .where(eq(clientes.id, visita.clienteId))
      .limit(1);

    const [tecnico] = visita.tecnicoId
      ? await tx
          .select({ id: usuarios.id, nombre: usuarios.nombre })
          .from(usuarios)
          .where(eq(usuarios.id, visita.tecnicoId))
          .limit(1)
      : [null];

    const itemsCatalogo = await tx
      .select()
      .from(checklistItemDefinicion)
      .where(eq(checklistItemDefinicion.activo, true))
      .orderBy(asc(checklistItemDefinicion.orden));

    const respuestas = await tx
      .select()
      .from(mantenimientoChecklistRespuesta)
      .where(eq(mantenimientoChecklistRespuesta.mantenimientoId, id));

    // Las fotos se piden en una sola consulta para todas las respuestas,
    // no una por punto.
    const idsRespuesta = respuestas.map((r) => r.id);
    const fotos = idsRespuesta.length
      ? await tx
          .select()
          .from(respuestaFoto)
          .where(inArray(respuestaFoto.respuestaId, idsRespuesta))
          .orderBy(asc(respuestaFoto.orden))
      : [];

    const fotosPorRespuesta = new Map<string, typeof fotos>();
    for (const foto of fotos) {
      const lista = fotosPorRespuesta.get(foto.respuestaId) ?? [];
      lista.push(foto);
      fotosPorRespuesta.set(foto.respuestaId, lista);
    }

    const respuestasPorItem = new Map(respuestas.map((r) => [r.itemId, r]));

    const observaciones = await tx
      .select()
      .from(mantenimientoObservacionBloque)
      .where(eq(mantenimientoObservacionBloque.mantenimientoId, id));

    const checklist = itemsCatalogo
      // Una visita semestral no arrastra los puntos anuales: se filtran
      // aquí para que el técnico no los vea ni pueda responderlos.
      .filter((item) => itemAplicaAVisita(item.periodicidadMeses, visita.tipo))
      .map((item) => {
        const respuesta = respuestasPorItem.get(item.id) ?? null;
        return {
          item,
          respuesta,
          fotos: respuesta ? (fotosPorRespuesta.get(respuesta.id) ?? []) : [],
        };
      });

    return {
      visita,
      cliente,
      tecnico: tecnico ?? null,
      checklist,
      observacionesBloque: observaciones,
    };
  });

  if (!resultado) {
    return NextResponse.json(
      { error: "Visita no encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json(resultado);
}

const esquemaActualizar = z.object({
  tecnicoId: z.string().uuid().nullable().optional(),
  tipo: esquemaTipoVisita.optional(),
  fechaPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaEjecucion: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
  contactado: z.boolean().optional(),
  fechaContacto: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
  viaWhatsapp: z.boolean().optional(),
  numeroFactura: z.string().max(50).nullable().optional(),
  comentariosGenerales: z.string().max(4000).nullable().optional(),
  equiposReemplazados: z.string().max(4000).nullable().optional(),
});

/** Asignación de técnico, fechas y datos de cierre de la visita. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parseo = esquemaActualizar.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const cambios = parseo.data;

  // Asignar técnico o mover la fecha es trabajo de oficina; el técnico solo
  // rellena su visita. RLS ya impide que toque las de otros, pero un
  // técnico no debe poder reasignarse las suyas.
  const soloOficina =
    cambios.tecnicoId !== undefined ||
    cambios.tipo !== undefined ||
    cambios.fechaPrevista !== undefined;

  if (soloOficina) {
    const denegado = exigirRolEscritura(sesion);
    if (denegado) return denegado;
  }

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select({ firmado: mantenimientos.firmado })
      .from(mantenimientos)
      .where(eq(mantenimientos.id, id))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };
    if (visita.firmado) {
      return {
        error: "La visita ya está firmada y no admite cambios.",
        estado: 409,
      };
    }

    const [fila] = await tx
      .update(mantenimientos)
      .set(cambios)
      .where(eq(mantenimientos.id, id))
      .returning();

    return { fila };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  return NextResponse.json(resultado.fila);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const denegado = exigirRolEscritura(sesion);
  if (denegado) return denegado;

  const { id } = await params;

  const [borrada] = await conSesionRLS(sesion, (tx) =>
    tx.delete(mantenimientos).where(eq(mantenimientos.id, id)).returning()
  );

  if (!borrada) {
    return NextResponse.json(
      { error: "Visita no encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
