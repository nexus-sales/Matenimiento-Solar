import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { conSesionRLS } from "@/db";
import {
  plantillaCampo,
  clientes,
  respuestas,
  observacionesBloque,
  intervenciones,
  respuestaFoto,
  usuarios,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { itemAplicaAVisita } from "@/lib/checklist";
import { bloquesDe } from "@/lib/plantillas";
import { InformeMantenimiento, type DatosInforme } from "@/lib/informe-pdf";
import {
  ALMACENAMIENTO_CONFIGURADO,
  guardarFoto,
  leerFoto,
} from "@/lib/almacenamiento";

/** Dónde vive el PDF ya generado, junto a las fotos de su misma visita. */
const claveInforme = (id: string) => `visitas/${id}/informe.pdf`;

/**
 * Descarga el acta de la visita en PDF.
 *
 * Se genera la primera vez que alguien la pide y se guarda; las siguientes
 * se sirven del almacenamiento. Dos motivos:
 *
 * - Generarla al firmar haría esperar al técnico en la cubierta mientras se
 *   componen treinta fotos.
 * - Generarla en cada descarga repetiría ese trabajo sin necesidad: la
 *   visita está firmada y su contenido ya no cambia.
 *
 * Y por eso mismo guardar es seguro aquí: un acta firmada es inmutable, así
 * que el archivo guardado no puede quedar desactualizado.
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

  // Toda la autorización se apoya en RLS: si la política no deja ver la
  // visita, no hay acta que generar.
  const datosCrudos = await conSesionRLS(sesion, async (tx) => {
    const [visita] = await tx
      .select()
      .from(intervenciones)
      .where(eq(intervenciones.id, id))
      .limit(1);
    if (!visita) return null;

    const [cliente] = await tx
      .select()
      .from(clientes)
      .where(eq(clientes.id, visita.clienteId))
      .limit(1);

    const [tecnico] = visita.tecnicoId
      ? await tx
          .select({ nombre: usuarios.nombre })
          .from(usuarios)
          .where(eq(usuarios.id, visita.tecnicoId))
          .limit(1)
      : [null];

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

    const filasRespuesta = await tx
      .select()
      .from(respuestas)
      .where(eq(respuestas.intervencionId, id));

    const idsRespuesta = filasRespuesta.map((r) => r.id);
    const fotos = idsRespuesta.length
      ? await tx
          .select()
          .from(respuestaFoto)
          .where(inArray(respuestaFoto.respuestaId, idsRespuesta))
          .orderBy(asc(respuestaFoto.orden))
      : [];

    const observaciones = await tx
      .select()
      .from(observacionesBloque)
      .where(eq(observacionesBloque.intervencionId, id));

    return { visita, cliente, tecnico, items, filasRespuesta, fotos, observaciones };
  });

  if (!datosCrudos) {
    return NextResponse.json(
      { error: "Visita no encontrada." },
      { status: 404 }
    );
  }

  const { visita, cliente, tecnico, items, filasRespuesta, fotos, observaciones } =
    datosCrudos;

  if (!visita.firmado) {
    return NextResponse.json(
      {
        error:
          "El acta se genera cuando la visita está firmada. Esta todavía está abierta.",
      },
      { status: 409 }
    );
  }

  const nombreArchivo = `acta-${cliente.nombre.replace(/[^\w]+/g, "-").toLowerCase()}-${(visita.fechaEjecucion ?? "").slice(0, 10)}.pdf`;

  // ¿Ya está generada?
  if (ALMACENAMIENTO_CONFIGURADO) {
    const guardado = await leerFoto(claveInforme(id));
    if (guardado) {
      return new NextResponse(Buffer.from(guardado.cuerpo), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${nombreArchivo}"`,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  }

  // --- componer los datos del documento ---

  const porItem = new Map(filasRespuesta.map((r) => [r.campoId, r]));
  const fotosPorRespuesta = new Map<string, typeof fotos>();
  for (const f of fotos) {
    const lista = fotosPorRespuesta.get(f.respuestaId) ?? [];
    lista.push(f);
    fotosPorRespuesta.set(f.respuestaId, lista);
  }

  const obsPorCategoria = new Map(
    observaciones.map((o) => [o.categoria, o.observacion])
  );

  // react-pdf no descarga imágenes: hay que traerlas y pasarlas incrustadas.
  const cacheFotos = new Map<string, string>();
  async function comoDataUri(clave: string): Promise<string | null> {
    if (cacheFotos.has(clave)) return cacheFotos.get(clave)!;
    const objeto = await leerFoto(clave);
    if (!objeto) return null;
    const uri = `data:${objeto.tipo};base64,${Buffer.from(objeto.cuerpo).toString("base64")}`;
    cacheFotos.set(clave, uri);
    return uri;
  }

  const aplicables = items.filter((i) =>
    itemAplicaAVisita(i.periodicidadMeses, visita.tipo)
  );

  const bloques: DatosInforme["bloques"] = [];

  // Los bloques de SU plantilla. Antes se recorrian los cinco del checklist
  // de mantenimiento: en un acta de obra no coincide ninguno y el PDF habria
  // salido sin un solo campo.
  for (const bloque of bloquesDe(
    visita.plantilla,
    aplicables.map((i) => i.categoria)
  )) {
    const delBloque = aplicables.filter((i) => i.categoria === bloque.clave);
    if (!delBloque.length) continue;

    const puntos: DatosInforme["bloques"][number]["puntos"] = [];

    for (const item of delBloque) {
      const respuesta = porItem.get(item.id);
      const susFotos = respuesta
        ? (fotosPorRespuesta.get(respuesta.id) ?? [])
        : [];

      const incrustadas: string[] = [];
      if (ALMACENAMIENTO_CONFIGURADO) {
        for (const f of susFotos) {
          const uri = await comoDataUri(f.url);
          // Una foto que ya no está en el almacenamiento no debe impedir
          // que se emita el acta: se omite y el resto sigue.
          if (uri) incrustadas.push(uri);
        }
      }

      puntos.push({
        nombre: item.nombre,
        periodicidadMeses: item.periodicidadMeses,
        // Solo el checklist se cierra con una marca de estado; los demas
        // campos, con lo anotado o con la propia foto.
        estado: item.tipo === "estado" ? (respuesta?.estado ?? "sin_revisar") : null,
        valor: respuesta?.valor ?? null,
        observacion: respuesta?.observacion ?? null,
        fotos: incrustadas,
      });
    }

    bloques.push({
      clave: bloque.clave,
      titulo: bloque.nombre,
      observacion: obsPorCategoria.get(bloque.clave) ?? null,
      puntos,
    });
  }

  const datos: DatosInforme = {
    visita: {
      id: visita.id,
      tipo: visita.tipo,
      fechaPrevista: visita.fechaPrevista,
      fechaEjecucion: visita.fechaEjecucion,
      numeroFactura: visita.numeroFactura,
      comentariosGenerales: visita.comentariosGenerales,
      equiposReemplazados: visita.equiposReemplazados,
      firmaTecnico: visita.firmaTecnico,
      firmanteTecnicoNombre: visita.firmanteTecnicoNombre,
      firmanteTecnicoDocumento: visita.firmanteTecnicoDocumento,
      firmaCliente: visita.firmaCliente,
      firmanteClienteNombre: visita.firmanteClienteNombre,
      firmanteClienteDocumento: visita.firmanteClienteDocumento,
      firmadoEn: visita.firmadoEn ? visita.firmadoEn.toISOString() : null,
      anulada: visita.anulada,
      motivoAnulacion: visita.motivoAnulacion,
      anuladaEn: visita.anuladaEn ? visita.anuladaEn.toISOString() : null,
    },
    cliente: {
      nombre: cliente.nombre,
      documento: cliente.documento,
      direccion: cliente.direccion,
      poblacion: cliente.poblacion,
      codigoPostal: cliente.codigoPostal,
      isla: cliente.isla,
      provincia: cliente.provincia,
      telefono: cliente.telefono,
      email: cliente.email,
      cups: cliente.cups,
      potenciaNominal: cliente.potenciaNominal,
      potenciaContratada: cliente.potenciaContratada,
      marcaInversor: cliente.marcaInversor,
      numeroInversor: cliente.numeroInversor,
      comercializadora: cliente.comercializadora,
      tieneBateria: cliente.tieneBateria,
    },
    tecnico: tecnico?.nombre ?? null,
    bloques,
  };

  const pdf = await renderToBuffer(<InformeMantenimiento datos={datos} />);

  // Se guarda para las próximas descargas. Que esto falle no debe impedir
  // que el usuario reciba su acta ahora.
  if (ALMACENAMIENTO_CONFIGURADO) {
    try {
      await guardarFoto(claveInforme(id), Buffer.from(pdf), "application/pdf");
    } catch {
      // Se regenerará la próxima vez.
    }
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombreArchivo}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
