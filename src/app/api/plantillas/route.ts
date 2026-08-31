import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import { plantillaCampo, respuestas } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { exigirAdmin } from "@/lib/permisos";
import { PLANTILLAS } from "@/lib/plantillas";

/**
 * El catálogo de campos de las tres plantillas.
 *
 * Lo lee cualquiera con sesión —la política `checklist_item_select` ya lo
 * permite, y el formulario lo necesita— pero solo administración lo modifica.
 */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const campos = await conSesionRLS(sesion, (tx) =>
    tx
      .select()
      .from(plantillaCampo)
      .orderBy(asc(plantillaCampo.plantilla), asc(plantillaCampo.orden))
  );

  // Cuántas respuestas tiene ya cada campo. Sirve para avisar antes de
  // desactivar algo que ya se ha respondido en visitas reales: desactivarlo
  // no borra nada, pero deja de pedirse en las nuevas y conviene saberlo.
  const ids = campos.map((c) => c.id);
  const usos = ids.length
    ? await conSesionRLS(sesion, (tx) =>
        tx
          .select({
            campoId: respuestas.campoId,
            n: sql<number>`count(*)::int`,
          })
          .from(respuestas)
          .where(inArray(respuestas.campoId, ids))
          .groupBy(respuestas.campoId)
      )
    : [];

  const porCampo = new Map(usos.map((u) => [u.campoId, u.n]));

  return NextResponse.json(
    campos.map((c) => ({ ...c, respuestas: porCampo.get(c.id) ?? 0 }))
  );
}

const esquemaCambio = z.object({
  plantilla: z.enum(PLANTILLAS),
  /** Campos a activar o desactivar, por id. */
  cambios: z
    .array(z.object({ id: z.string().uuid(), activo: z.boolean() }))
    .min(1)
    .max(200),
});

/**
 * Activa o desactiva campos de una plantilla.
 *
 * Desactivar NO borra: las respuestas que ya existen se conservan y siguen
 * saliendo en las actas firmadas. Solo deja de pedirse en las visitas nuevas.
 * Es la diferencia entre corregir el formulario y reescribir el pasado.
 */
export async function PATCH(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const denegado = exigirAdmin(sesion);
  if (denegado) return denegado;

  const parseo = esquemaCambio.safeParse(await req.json());
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Cambios inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { plantilla, cambios } = parseo.data;

  const resultado = await conSesionRLS(sesion, async (tx) => {
    // Se comprueba que los campos son de la plantilla que dice quien llama.
    // Sin esto, una petición fabricada podría desactivar campos de otra.
    const suyos = await tx
      .select({ id: plantillaCampo.id })
      .from(plantillaCampo)
      .where(
        and(
          eq(plantillaCampo.plantilla, plantilla),
          inArray(
            plantillaCampo.id,
            cambios.map((c) => c.id)
          )
        )
      );

    if (suyos.length !== cambios.length) {
      return {
        error: "Algún campo no pertenece a esa plantilla.",
        estado: 400 as const,
      };
    }

    // Una plantilla sin ningún campo activo produciría un formulario en
    // blanco que se puede firmar sin rellenar nada.
    const activos = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(plantillaCampo)
      .where(
        and(
          eq(plantillaCampo.plantilla, plantilla),
          eq(plantillaCampo.activo, true)
        )
      );

    const desactivando = cambios.filter((c) => !c.activo).length;
    const activando = cambios.filter((c) => c.activo).length;
    if (activos[0].n - desactivando + activando <= 0) {
      return {
        error:
          "No puedes dejar la plantilla sin ningún campo activo: el " +
          "formulario quedaría en blanco.",
        estado: 409 as const,
      };
    }

    for (const c of cambios) {
      await tx
        .update(plantillaCampo)
        .set({ activo: c.activo })
        .where(eq(plantillaCampo.id, c.id));
    }

    return { n: cambios.length };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  return NextResponse.json({ actualizados: resultado.n });
}
