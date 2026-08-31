import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { clientes, intervenciones, usuarios } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirRolEscritura } from "@/lib/permisos";
import { esquemaCliente, valoresCliente } from "@/lib/esquemas";
import { errorDeDuplicado } from "@/lib/conflictos";
import {
  actasFirmadasDe,
  borrarDelAlmacen,
  clavesDeAlmacenamiento,
  intervencionesDe,
} from "@/lib/borrado";

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

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [cliente] = await tx
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.id, id))
      .limit(1);

    if (!cliente) {
      return { error: "Cliente no encontrado.", estado: 404 as const };
    }

    // Borrar un cliente arrastra en cascada TODO su histórico: visitas,
    // respuestas y fotos. Si entre ellas hay actas firmadas, eso es destruir
    // documentos que el cliente firmó y de los que puede tener copia.
    //
    // Se bloquea. No es una molestia gratuita: la aplicación afirma —al
    // técnico, al cliente y en la política de privacidad— que un acta
    // firmada no se altera ni desaparece, y sin esta guarda esa afirmación
    // era falsa. Un cliente que ya no lo es se desmarca del mantenimiento en
    // su ficha; su histórico se queda donde tiene que estar.
    const firmadas = await actasFirmadasDe(tx, id);
    if (firmadas > 0) {
      return {
        error:
          `Este cliente tiene ${firmadas} acta${firmadas === 1 ? "" : "s"} ` +
          `firmada${firmadas === 1 ? "" : "s"} y no se puede borrar: se ` +
          "destruiría documentación firmada por él. Si ya no es cliente, " +
          "desmarca «tiene mantenimiento» en su ficha.",
        estado: 409 as const,
      };
    }

    // Sin actas firmadas sí se borra, y hay que llevarse también lo que haya
    // en el almacén: la cascada limpia las filas, no los archivos.
    const visitas = await intervencionesDe(tx, id);
    const claves = await clavesDeAlmacenamiento(
      tx,
      visitas.map((v) => v.id)
    );

    await tx.delete(clientes).where(eq(clientes.id, id));
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
