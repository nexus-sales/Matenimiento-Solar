import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import {
  plantillaCampo,
  respuestas,
  respuestaFoto,
  intervenciones,
} from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { itemAplicaAVisita } from "@/lib/checklist";
import { campoPendiente } from "@/lib/plantillas";
import { validarDocumento } from "@/lib/validacion";

/**
 * Una firma manuscrita capturada en el móvil. Llega como data URL de PNG.
 * Se limita el tamaño porque un trazo a mano alzada ocupa unas decenas de
 * KB: cualquier cosa mucho mayor es una foto colada por aquí.
 */
const MAX_FIRMA = 400_000; // caracteres de base64, ~300 KB de imagen

const esquemaFirma = z
  .string()
  .max(MAX_FIRMA, "La firma es demasiado grande.")
  .refine(
    (v) => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v),
    "La firma tiene que ser un PNG en base64."
  );

const esquemaFirmante = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre de quien firma.").max(200),
  documento: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine(validarDocumento, "Documento inválido."),
  firma: esquemaFirma,
});

const esquemaCierre = z.object({
  tecnico: esquemaFirmante,
  cliente: esquemaFirmante,
  fechaEjecucion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de ejecución inválida."),
});

/**
 * Cierra y firma la visita. A partir de aquí el registro es inmutable:
 * el informe que se lleva el cliente y lo que queda en la base tienen que
 * decir exactamente lo mismo, y esa es toda la gracia de una firma.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parseo = esquemaCierre.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos de firma inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const datos = parseo.data;

  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select()
      .from(intervenciones)
      .where(eq(intervenciones.id, id))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };
    if (visita.firmado) {
      return { error: "Esta visita ya estaba firmada.", estado: 409 };
    }

    // No se firma una visita a medias. Se comprueba contra los puntos que
    // de verdad tocaban a esta visita, no contra los 24 del catálogo.
    const items = await tx
      .select()
      .from(plantillaCampo)
      .where(
        and(
          eq(plantillaCampo.activo, true),
          eq(plantillaCampo.plantilla, visita.plantilla)
        )
      )
      .orderBy(asc(plantillaCampo.orden));

    const aplicables = items.filter((i) =>
      itemAplicaAVisita(i.periodicidadMeses, visita.tipo)
    );

    const filasRespuesta = await tx
      .select()
      .from(respuestas)
      .where(eq(respuestas.intervencionId, id));

    const porItem = new Map(filasRespuesta.map((r) => [r.campoId, r]));

    // Cuantas fotos tiene cada respuesta: en el acta de obra la mayoria de
    // los campos obligatorios se cumplen subiendo una foto, no marcando nada,
    // asi que sin este recuento no se puede saber si estan hechos.
    const idsRespuesta = filasRespuesta.map((r) => r.id);
    const conteoFotos = new Map<string, number>();
    if (idsRespuesta.length) {
      const filas = await tx
        .select({
          respuestaId: respuestaFoto.respuestaId,
          n: sql<number>`count(*)::int`,
        })
        .from(respuestaFoto)
        .where(inArray(respuestaFoto.respuestaId, idsRespuesta))
        .groupBy(respuestaFoto.respuestaId);
      for (const f of filas) conteoFotos.set(f.respuestaId, f.n);
    }

    const pendientes = aplicables.filter((i) => {
      const r = porItem.get(i.id) ?? null;
      return campoPendiente(i, r, r ? (conteoFotos.get(r.id) ?? 0) : 0);
    });

    if (pendientes.length) {
      return {
        error:
          `Quedan ${pendientes.length} campo(s) sin completar. ` +
          `El primero: "${pendientes[0].nombre}".`,
        estado: 409,
      };
    }

    // Una incidencia sin explicar no le sirve de nada a la oficina.
    const sinExplicar = aplicables.filter((i) => {
      const r = porItem.get(i.id);
      return r?.estado === "incidencia" && !r.observacion?.trim();
    });

    if (sinExplicar.length) {
      return {
        error: `Hay incidencias sin observación: "${sinExplicar[0].nombre}".`,
        estado: 409,
      };
    }

    const [fila] = await tx
      .update(intervenciones)
      .set({
        fechaEjecucion: datos.fechaEjecucion,
        firmaTecnico: datos.tecnico.firma,
        firmanteTecnicoNombre: datos.tecnico.nombre,
        firmanteTecnicoDocumento: datos.tecnico.documento,
        firmaCliente: datos.cliente.firma,
        firmanteClienteNombre: datos.cliente.nombre,
        firmanteClienteDocumento: datos.cliente.documento,
        firmado: true,
        firmadoEn: new Date(),
      })
      .where(eq(intervenciones.id, id))
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
