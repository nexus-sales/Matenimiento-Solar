import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { clientes, intervenciones, usuarios } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirRolEscritura } from "@/lib/permisos";
import { esquemaCliente, valoresCliente } from "@/lib/esquemas";
import { errorDeDuplicado } from "@/lib/conflictos";

/**
 * Ficha completa del cliente más su histórico de visitas. Las visitas se
 * leen aquí, pero se gestionan desde el módulo de mantenimientos: este
 * endpoint no las crea ni las modifica.
 */
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
    const [cliente] = await tx
      .select()
      .from(clientes)
      .where(eq(clientes.id, id))
      .limit(1);
    if (!cliente) return null;

    const historico = await tx
      .select({
        id: intervenciones.id,
        fechaPrevista: intervenciones.fechaPrevista,
        fechaEjecucion: intervenciones.fechaEjecucion,
        contactado: intervenciones.contactado,
        firmado: intervenciones.firmado,
        anulada: intervenciones.anulada,
        comentariosGenerales: intervenciones.comentariosGenerales,
        tecnicoNombre: usuarios.nombre,
      })
      .from(intervenciones)
      .leftJoin(usuarios, eq(intervenciones.tecnicoId, usuarios.id))
      .where(eq(intervenciones.clienteId, id))
      .orderBy(desc(intervenciones.fechaPrevista));

    return { cliente, mantenimientos: historico };
  });

  if (!resultado) {
    return NextResponse.json(
      { error: "Cliente no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json(resultado);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const denegado = exigirRolEscritura(sesion);
  if (denegado) return denegado;

  const { id } = await params;
  const body = await req.json();

  // La edición valida con el MISMO esquema que el alta: no hay forma de
  // dejar una ficha guardada en un estado que el alta habría rechazado.
  const parseo = esquemaCliente.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const [actualizado] = await conSesionRLS(sesion, (tx) =>
      tx
        .update(clientes)
        .set(valoresCliente(parseo.data))
        .where(eq(clientes.id, id))
        .returning()
    );

    if (!actualizado) {
      return NextResponse.json(
        { error: "Cliente no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(actualizado);
  } catch (err: unknown) {
    const conflicto = errorDeDuplicado(err);
    if (conflicto) return conflicto;
    throw err;
  }
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

  // Borra en cascada el histórico de mantenimientos del cliente (definido
  // en el esquema con onDelete: "cascade"). La interfaz debe pedir
  // confirmación antes de llamar aquí.
  const [borrado] = await conSesionRLS(sesion, (tx) =>
    tx.delete(clientes).where(eq(clientes.id, id)).returning()
  );

  if (!borrado) {
    return NextResponse.json(
      { error: "Cliente no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
