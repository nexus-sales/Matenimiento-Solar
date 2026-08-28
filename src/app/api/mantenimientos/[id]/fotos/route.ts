import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import {
  mantenimientoChecklistRespuesta,
  mantenimientos,
  respuestaFoto,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import {
  ALMACENAMIENTO_CONFIGURADO,
  MAX_BYTES_FOTO,
  TIPOS_IMAGEN,
  claveFoto,
  extensionDe,
  guardarFoto,
} from "@/lib/almacenamiento";

/** Tope por punto. Más que esto no ayuda al informe, solo lo hace ilegible. */
const MAX_FOTOS_POR_PUNTO = 6;

/**
 * Sube una foto a un punto del checklist.
 *
 * La imagen viaja por la aplicación en lugar de ir directa al almacenamiento
 * con un enlace firmado, porque MinIO está en la red interna de Docker y el
 * navegador no lo alcanza. A cambio, cada subida pasa por RLS: si el técnico
 * no puede escribir en esa visita, la fila de la respuesta no se crea y la
 * foto no se guarda.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!ALMACENAMIENTO_CONFIGURADO) {
    return NextResponse.json(
      {
        error:
          "El almacenamiento de fotos no está configurado en este entorno.",
      },
      { status: 503 }
    );
  }

  const { id: mantenimientoId } = await params;

  const formulario = await req.formData();
  const archivo = formulario.get("archivo");
  const itemId = String(formulario.get("itemId") || "");
  const pie = String(formulario.get("pie") || "").trim() || null;

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  if (!itemId) {
    return NextResponse.json(
      { error: "Falta el punto del checklist al que pertenece la foto." },
      { status: 400 }
    );
  }
  if (!TIPOS_IMAGEN.includes(archivo.type as (typeof TIPOS_IMAGEN)[number])) {
    return NextResponse.json(
      { error: "Solo se admiten imágenes JPEG, PNG o WebP." },
      { status: 400 }
    );
  }
  if (archivo.size > MAX_BYTES_FOTO) {
    return NextResponse.json(
      { error: "La imagen es demasiado grande." },
      { status: 413 }
    );
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const clave = claveFoto(mantenimientoId, itemId, extensionDe(archivo.type));

  // Primero la base, luego el archivo. Si el almacenamiento falla, se
  // deshace la transacción y no queda una fila apuntando a una foto que no
  // existe. Al revés dejaría archivos huérfanos que nadie sabría borrar.
  const resultado = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select({ firmado: mantenimientos.firmado })
      .from(mantenimientos)
      .where(eq(mantenimientos.id, mantenimientoId))
      .limit(1);

    if (!visita) return { error: "Visita no encontrada.", estado: 404 };
    if (visita.firmado) {
      return {
        error: "La visita ya está firmada y no admite cambios.",
        estado: 409,
      };
    }

    // La respuesta del punto puede no existir todavía si el técnico hace la
    // foto antes de marcar el estado. Se crea en blanco para colgarla de ahí.
    let [respuesta] = await tx
      .select()
      .from(mantenimientoChecklistRespuesta)
      .where(
        and(
          eq(mantenimientoChecklistRespuesta.mantenimientoId, mantenimientoId),
          eq(mantenimientoChecklistRespuesta.itemId, itemId)
        )
      )
      .limit(1);

    if (!respuesta) {
      [respuesta] = await tx
        .insert(mantenimientoChecklistRespuesta)
        .values({ mantenimientoId, itemId })
        .returning();
    }

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(respuestaFoto)
      .where(eq(respuestaFoto.respuestaId, respuesta.id));

    if (n >= MAX_FOTOS_POR_PUNTO) {
      return {
        error: `Máximo ${MAX_FOTOS_POR_PUNTO} fotos por punto.`,
        estado: 409,
      };
    }

    const [fila] = await tx
      .insert(respuestaFoto)
      .values({ respuestaId: respuesta.id, url: clave, pie, orden: n })
      .returning();

    await guardarFoto(clave, bytes, archivo.type);

    return { fila };
  });

  if ("error" in resultado && resultado.error) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.estado }
    );
  }

  return NextResponse.json(resultado.fila, { status: 201 });
}
