import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import { clientes, mantenimientos, usuarios } from "@/db/schema";
import { and, asc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirRolEscritura } from "@/lib/permisos";
import { esquemaTipoVisita } from "@/lib/checklist";

/**
 * Listado general de visitas de mantenimiento. RLS se encarga de que un
 * técnico solo vea las suyas.
 *
 * Filtro opcional `?estado=pendientes|vencidos|completados`.
 */
export async function GET(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const estado = req.nextUrl.searchParams.get("estado");
  const hoyFecha = new Date();
  const mes = String(hoyFecha.getMonth() + 1).padStart(2, "0");
  const dia = String(hoyFecha.getDate()).padStart(2, "0");
  const hoy = `${hoyFecha.getFullYear()}-${mes}-${dia}`;

  const condicion =
    estado === "pendientes"
      ? isNull(mantenimientos.fechaEjecucion)
      : estado === "vencidos"
        ? and(
            isNull(mantenimientos.fechaEjecucion),
            lt(mantenimientos.fechaPrevista, hoy)
          )
        : estado === "completados"
          ? isNotNull(mantenimientos.fechaEjecucion)
          : undefined;

  const resultado = await conSesionRLS(sesion, (tx) =>
    tx
      .select({
        id: mantenimientos.id,
        fechaPrevista: mantenimientos.fechaPrevista,
        fechaEjecucion: mantenimientos.fechaEjecucion,
        contactado: mantenimientos.contactado,
        firmado: mantenimientos.firmado,
        tipo: mantenimientos.tipo,
        cups: clientes.cups,
        isla: clientes.isla,
        direccion: clientes.direccion,
        clienteId: clientes.id,
        clienteNombre: clientes.nombre,
        tecnicoId: usuarios.id,
        tecnicoNombre: usuarios.nombre,
      })
      .from(mantenimientos)
      .innerJoin(clientes, eq(mantenimientos.clienteId, clientes.id))
      .leftJoin(usuarios, eq(mantenimientos.tecnicoId, usuarios.id))
      .where(condicion)
      .orderBy(asc(mantenimientos.fechaPrevista))
  );

  return NextResponse.json(resultado);
}


const esquemaNuevaVisita = z.object({
  clienteId: z.string().uuid(),
  tipo: esquemaTipoVisita,
  fechaPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  tecnicoId: z.string().uuid().nullable().optional(),
});

/**
 * Programa una visita. Es trabajo de oficina: el técnico ejecuta lo que
 * tiene asignado, no se auto-asigna trabajo.
 */
export async function POST(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const denegado = exigirRolEscritura(sesion);
  if (denegado) return denegado;

  const body = await req.json();
  const parseo = esquemaNuevaVisita.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const datos = parseo.data;

  const resultado = await conSesionRLS(sesion, async (tx) => {
    // Programar una visita a un cliente sin mantenimiento contratado casi
    // siempre es un error de selección, no una excepción legítima.
    const [cliente] = await tx
      .select({
        id: clientes.id,
        tieneMantenimiento: clientes.tieneMantenimiento,
      })
      .from(clientes)
      .where(eq(clientes.id, datos.clienteId))
      .limit(1);

    if (!cliente) return { error: "El cliente no existe.", estado: 400 };
    if (!cliente.tieneMantenimiento) {
      return {
        error:
          "Ese cliente no tiene mantenimiento contratado. Actívalo en su ficha antes de programar la visita.",
        estado: 409,
      };
    }

    if (datos.tecnicoId) {
      const [tecnico] = await tx
        .select({ rol: usuarios.rol, activo: usuarios.activo })
        .from(usuarios)
        .where(eq(usuarios.id, datos.tecnicoId))
        .limit(1);

      if (!tecnico || tecnico.rol !== "tecnico" || !tecnico.activo) {
        return {
          error: "El técnico asignado no existe o no está activo.",
          estado: 400,
        };
      }
    }

    const [creada] = await tx
      .insert(mantenimientos)
      .values({
        clienteId: datos.clienteId,
        tipo: datos.tipo,
        fechaPrevista: datos.fechaPrevista,
        tecnicoId: datos.tecnicoId ?? null,
      })
      .returning();

    return { fila: creada };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  return NextResponse.json(resultado.fila, { status: 201 });
}
