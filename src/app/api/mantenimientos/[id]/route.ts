import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import {
  clientes,
  intervenciones,
  respuestas,
  observacionesBloque,
  plantillaCampo,
  respuestaFoto,
  usuarios,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirRolEscritura } from "@/lib/permisos";
import { esquemaTipoVisita, itemAplicaAVisita } from "@/lib/checklist";
import { ALMACENAMIENTO_CONFIGURADO, borrarFoto } from "@/lib/almacenamiento";
import { borrarDelAlmacen, clavesDeAlmacenamiento } from "@/lib/borrado";

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
      .from(intervenciones)
      .where(eq(intervenciones.id, id))
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
          .select({
            id: usuarios.id,
            nombre: usuarios.nombre,
            documento: usuarios.documento,
          })
          .from(usuarios)
          .where(eq(usuarios.id, visita.tecnicoId))
          .limit(1)
      : [null];

    // Solo los campos de SU plantilla. Sin este filtro, ahora que el
    // catalogo tiene los 131 campos de las tres, una visita de
    // mantenimiento mostraria tambien los del acta de obra.
    const itemsCatalogo = await tx
      .select()
      .from(plantillaCampo)
      .where(
        and(
          eq(plantillaCampo.activo, true),
          eq(plantillaCampo.plantilla, visita.plantilla)
        )
      )
      .orderBy(asc(plantillaCampo.orden));

    const filasRespuesta = await tx
      .select()
      .from(respuestas)
      .where(eq(respuestas.intervencionId, id));

    // Las fotos se piden en una sola consulta para todas las respuestas,
    // no una por punto.
    const idsRespuesta = filasRespuesta.map((r) => r.id);
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

    const respuestasPorItem = new Map(filasRespuesta.map((r) => [r.campoId, r]));

    const observaciones = await tx
      .select()
      .from(observacionesBloque)
      .where(eq(observacionesBloque.intervencionId, id));

    const checklist = itemsCatalogo
      // Una visita semestral no arrastra los puntos anuales: se filtran
      // aquí para que el técnico no los vea ni pueda responderlos. En las
      // otras dos plantillas no hay periodicidad y pasan todos.
      .filter((item) => itemAplicaAVisita(item.periodicidadMeses, visita.tipo))
      .map((item) => {
        const respuesta = respuestasPorItem.get(item.id) ?? null;
        return {
          item,
          respuesta,
          fotos: respuesta ? (fotosPorRespuesta.get(respuesta.id) ?? []) : [],
        };
      });

    // La lista de técnicos viaja con la visita, y solo para quien puede
    // asignar. Pedirla aparte no valdría: /api/usuarios es exclusivo de
    // admin, y oficina también necesita reasignar.
    const puedeAsignar = sesion.rol === "admin" || sesion.rol === "oficina";

    const tecnicos = puedeAsignar
      ? await tx
          .select({
            id: usuarios.id,
            nombre: usuarios.nombre,
            isla: usuarios.isla,
          })
          .from(usuarios)
          .where(and(eq(usuarios.rol, "tecnico"), eq(usuarios.activo, true)))
          .orderBy(asc(usuarios.nombre))
      : [];

    return {
      visita,
      cliente,
      tecnico: tecnico ?? null,
      checklist,
      observacionesBloque: observaciones,
      puedeAsignar,
      // Anular es corrección sobre un documento firmado: solo administración.
      puedeAnular: sesion.rol === "admin",
      tecnicos,
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
  //
  // `numeroFactura` entra en esta lista aunque no lo parezca: facturar es
  // trabajo de oficina, y es el ÚNICO campo que se puede tocar después de
  // firmar. Sin esta guarda, un técnico asignado podía escribir el número de
  // factura de un acta ya firmada, y ese número sale impreso en el PDF.
  const soloOficina =
    cambios.tecnicoId !== undefined ||
    cambios.tipo !== undefined ||
    cambios.fechaPrevista !== undefined ||
    cambios.numeroFactura !== undefined;

  if (soloOficina) {
    const denegado = exigirRolEscritura(sesion);
    if (denegado) return denegado;
  }

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select({ firmado: intervenciones.firmado })
      .from(intervenciones)
      .where(eq(intervenciones.id, id))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };

    // Una visita firmada es inmutable EN LO QUE SE FIRMÓ: el checklist, las
    // observaciones, las fotos y las fechas de la intervención.
    //
    // El número de factura no es eso. Lo asigna la oficina después, al
    // facturar, y el cliente no lo firmó. Tratarlo como parte del acta lo
    // dejaba imposible de rellenar: aparecía en el documento y no había
    // manera de ponerlo nunca.
    if (visita.firmado) {
      const soloFactura =
        Object.keys(cambios).length === 1 && "numeroFactura" in cambios;

      if (!soloFactura) {
        return {
          error:
            "La visita ya está firmada: solo puede modificarse el número de factura.",
          estado: 409,
        };
      }
    }

    // La clave foránea solo garantiza que el usuario exista. Sin esta
    // comprobación se podría asignar una visita a alguien de oficina, o a un
    // técnico dado de baja — y entonces la visita no aparecería en la lista
    // de nadie, sin que nada avisara.
    if (cambios.tecnicoId) {
      const [tec] = await tx
        .select({ rol: usuarios.rol, activo: usuarios.activo })
        .from(usuarios)
        .where(eq(usuarios.id, cambios.tecnicoId))
        .limit(1);

      if (!tec || tec.rol !== "tecnico" || !tec.activo) {
        return {
          error: "El técnico asignado no existe o no está activo.",
          estado: 400,
        };
      }
    }

    const [fila] = await tx
      .update(intervenciones)
      .set(cambios)
      .where(eq(intervenciones.id, id))
      .returning();

    return { fila, facturaCambiada: "numeroFactura" in cambios };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  // El acta guardada lleva el número de factura impreso: si cambia, la que
  // hay almacenada deja de ser correcta. Se borra para que se regenere en la
  // siguiente descarga.
  if (resultado.facturaCambiada && ALMACENAMIENTO_CONFIGURADO) {
    try {
      await borrarFoto(`visitas/${id}/informe.pdf`);
    } catch {
      // Si no existía, no hay nada que invalidar.
    }
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

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select({ firmado: intervenciones.firmado })
      .from(intervenciones)
      .where(eq(intervenciones.id, id))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 as const };

    // Una visita firmada NO se borra. El cliente firmó ese documento y puede
    // tener una copia; hacerlo desaparecer del histórico deja un hueco sin
    // explicación y destruye la prueba de un trabajo realizado.
    //
    // Para eso está anular: conserva el acta con su sello de «sin validez» y
    // programa una sustituta. La aplicación promete que un acta firmada no se
    // toca, y esta guarda es la que hace que sea verdad.
    if (visita.firmado) {
      return {
        error:
          "Una visita firmada no se puede borrar. Si el acta es incorrecta, " +
          "anúlala: se conserva marcada como sin validez y se programa otra.",
        estado: 409 as const,
      };
    }

    // Las claves se recogen ANTES de borrar: la cascada se lleva las filas
    // que dicen qué archivos existen, y después no habría forma de saberlo.
    const claves = await clavesDeAlmacenamiento(tx, [id]);

    await tx.delete(intervenciones).where(eq(intervenciones.id, id));
    return { claves };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  await borrarDelAlmacen(resultado.claves ?? []);

  return NextResponse.json({ ok: true });
}
