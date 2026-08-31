import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import {
  respuestas,
  intervenciones,
  respuestaFoto,
  plantillaCampo,
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
 * Comprueba la firma del archivo: los primeros bytes que identifican el
 * formato de verdad, al margen de lo que diga la cabecera del navegador.
 *
 * Los tres formatos que acepta la app tienen firma fija:
 *   JPEG  FF D8
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   WebP  "RIFF" .... "WEBP"
 */
function esImagenDeVerdad(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8) return true;
  if (
    b.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return true;
  }
  return (
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP"
  );
}

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

  const { id: intervencionId } = await params;

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

  // `archivo.type` es la cabecera que envia el cliente, no el contenido: se
  // puede declarar image/jpeg y subir cualquier cosa. Aqui se miran los
  // primeros bytes, que si son el archivo de verdad.
  if (!esImagenDeVerdad(bytes)) {
    return NextResponse.json(
      { error: "El archivo no es una imagen JPEG, PNG o WebP válida." },
      { status: 400 }
    );
  }

  const clave = claveFoto(intervencionId, itemId, extensionDe(archivo.type));

  // Primero la base, luego el archivo. Si el almacenamiento falla, se
  // deshace la transacción y no queda una fila apuntando a una foto que no
  // existe. Al revés dejaría archivos huérfanos que nadie sabría borrar.
  const resultado = await conSesionRLS(sesion, async (tx) => {
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

    // La respuesta del punto puede no existir todavía si el técnico hace la
    // foto antes de marcar el estado. Se crea en blanco para colgarla de ahí.
    let [respuesta] = await tx
      .select()
      .from(respuestas)
      .where(
        and(
          eq(respuestas.intervencionId, intervencionId),
          eq(respuestas.campoId, itemId)
        )
      )
      .limit(1);

    if (!respuesta) {
      [respuesta] = await tx
        .insert(respuestas)
        .values({ intervencionId, campoId: itemId })
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
