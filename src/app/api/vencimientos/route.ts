import { NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { clientes, intervenciones } from "@/db/schema";
import { and, eq, isNotNull, max } from "drizzle-orm";
import { obtenerSesion, tieneRol } from "@/lib/auth";
import { calcularVencimiento, type Vencimiento } from "@/lib/vencimientos";

/**
 * Qué clientes tienen la revisión vencida o a punto de vencer.
 *
 * Es trabajo de planificación, así que solo lo ven oficina y administración.
 * El técnico ejecuta lo que le asignan; saber a quién le toca revisión el mes
 * que viene no le sirve de nada y supondría enseñarle la cartera entera, que
 * es justo lo que la política de clientes evita.
 *
 * El cálculo se hace en la aplicación y no en SQL a propósito: «seis meses
 * después del 31 de agosto» es aritmética de calendario con casos raros —ver
 * `sumarMeses`— y prefiero tenerla en un sitio con pruebas que repartida en
 * una consulta difícil de leer.
 */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!tieneRol(sesion, ["admin", "oficina"])) {
    return NextResponse.json(
      { error: "No tienes permiso para ver la planificación." },
      { status: 403 }
    );
  }

  const filas = await conSesionRLS(sesion, async (tx) => {
    // Solo los que tienen mantenimiento contratado: son los únicos que entran
    // en la planificación.
    const conContrato = await tx
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        isla: clientes.isla,
        telefono: clientes.telefono,
        tieneMantenimiento: clientes.tieneMantenimiento,
        periodicidadMantenimiento: clientes.periodicidadMantenimiento,
        fechaInstalacion: clientes.fechaInstalacion,
      })
      .from(clientes)
      .where(eq(clientes.tieneMantenimiento, true));

    if (!conContrato.length) return [];

    // La última visita ejecutada de cada cliente, en una sola consulta.
    // Pedirla cliente a cliente serían tantas idas a la base como clientes.
    const ultimas = await tx
      .select({
        clienteId: intervenciones.clienteId,
        ultima: max(intervenciones.fechaEjecucion),
      })
      .from(intervenciones)
      .where(
        and(
          eq(intervenciones.plantilla, "mantenimiento"),
          eq(intervenciones.anulada, false),
          isNotNull(intervenciones.fechaEjecucion)
        )
      )
      .groupBy(intervenciones.clienteId);

    const porCliente = new Map(ultimas.map((u) => [u.clienteId, u.ultima]));

    // Y si ya hay una visita programada sin ejecutar, no hace falta avisar:
    // alguien se ocupó. Se marca para poder filtrarla fuera.
    const programadas = await tx
      .select({ clienteId: intervenciones.clienteId })
      .from(intervenciones)
      .where(
        and(
          eq(intervenciones.plantilla, "mantenimiento"),
          eq(intervenciones.anulada, false)
        )
      )
      .groupBy(intervenciones.clienteId);

    const conProgramada = new Set<string>();
    for (const p of programadas) {
      if (porCliente.get(p.clienteId) === null) conProgramada.add(p.clienteId);
    }

    return conContrato.map((c) => {
      const vencimiento: Vencimiento = calcularVencimiento({
        tieneMantenimiento: c.tieneMantenimiento,
        periodicidadMantenimiento: c.periodicidadMantenimiento,
        fechaInstalacion: c.fechaInstalacion,
        ultimaVisita: porCliente.get(c.id) ?? null,
      });

      return {
        id: c.id,
        nombre: c.nombre,
        isla: c.isla,
        telefono: c.telefono,
        periodicidadMantenimiento: c.periodicidadMantenimiento,
        ultimaVisita: porCliente.get(c.id) ?? null,
        yaProgramada: conProgramada.has(c.id),
        ...vencimiento,
      };
    });
  });

  // Lo que vence antes, primero: es el orden en que hay que atenderlo. Los
  // que no se pueden calcular van al final, porque no son urgentes — son
  // fichas incompletas.
  const orden = { vencido: 0, proximo: 1, al_dia: 2, sin_datos: 3 } as const;
  filas.sort(
    (a, b) =>
      orden[a.estado] - orden[b.estado] ||
      (a.dias ?? Infinity) - (b.dias ?? Infinity)
  );

  return NextResponse.json({
    clientes: filas,
    resumen: {
      vencidos: filas.filter((f) => f.estado === "vencido").length,
      proximos: filas.filter((f) => f.estado === "proximo").length,
      sinPeriodicidad: filas.filter((f) => f.estado === "sin_datos").length,
    },
  });
}
