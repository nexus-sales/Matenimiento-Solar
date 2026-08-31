import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { clientes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { obtenerSesion, tieneRol } from "@/lib/auth";
import { valoresCliente } from "@/lib/esquemas";
import { analizarExcel } from "@/lib/importar-clientes";

/** 8 MB. Una cartera de miles de clientes cabe de sobra. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Importa clientes desde un Excel.
 *
 * Funciona en dos pasos, y no por comodidad: primero **analiza sin escribir**
 * y devuelve qué haría fila por fila; solo cuando quien importa ha visto eso
 * y confirma, se escribe.
 *
 * Una importación masiva que empieza a escribir antes de que nadie vea el
 * resultado es la forma más rápida de ensuciar una base de datos con cientos
 * de fichas mal, y deshacerlo después es mucho más caro que mirarlo antes.
 *
 * La escritura va en UNA transacción: o entran todas las filas válidas o no
 * entra ninguna. A medio importar no se sabe por dónde se quedó.
 */
export async function POST(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!tieneRol(sesion, ["admin", "oficina"])) {
    return NextResponse.json(
      { error: "No tienes permiso para importar clientes." },
      { status: 403 }
    );
  }

  const formulario = await req.formData();
  const archivo = formulario.get("archivo");
  const confirmar = formulario.get("confirmar") === "si";
  // Qué hacer con un documento que ya existe en la base.
  const siExiste =
    formulario.get("siExiste") === "actualizar" ? "actualizar" : "saltar";

  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo." },
      { status: 400 }
    );
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo es demasiado grande (máximo 8 MB)." },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());

  // Los documentos ya guardados, para saber qué fila es alta y cuál no.
  const existentes = await conSesionRLS(sesion, (tx) =>
    tx.select({ documento: clientes.documento }).from(clientes)
  );
  const setExistentes = new Set(existentes.map((c) => c.documento));

  let analisis;
  try {
    analisis = await analizarExcel(buffer, setExistentes);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo leer el archivo. ¿Es un .xlsx válido?",
      },
      { status: 400 }
    );
  }

  const nuevas = analisis.filas.filter((f) => f.estado === "nuevo");
  const existen = analisis.filas.filter((f) => f.estado === "existente");
  const conError = analisis.filas.filter((f) => f.estado === "error");

  const resumen = {
    ...analisis,
    totales: {
      leidas: analisis.filas.length,
      nuevas: nuevas.length,
      existentes: existen.length,
      errores: conError.length,
    },
  };

  if (!confirmar) {
    return NextResponse.json({ ...resumen, importado: false });
  }

  // --- escritura ---

  if (analisis.duplicadosEnArchivo.length) {
    return NextResponse.json(
      {
        error:
          `El archivo repite ${analisis.duplicadosEnArchivo.length} documento(s). ` +
          "Corrígelo antes de importar: no se puede saber cuál de las dos filas vale.",
        duplicadosEnArchivo: analisis.duplicadosEnArchivo,
      },
      { status: 409 }
    );
  }

  const aInsertar = nuevas;
  const aActualizar = siExiste === "actualizar" ? existen : [];

  const escrito = await conSesionRLS(sesion, async (tx) => {
    let insertados = 0;
    let actualizados = 0;

    // Una sola sentencia en vez de una por fila. Con una cartera de mil
    // clientes eran mil viajes a la base, todos dentro de la misma
    // transacción: correcto, pero mucho más lento de lo necesario.
    const nuevos = aInsertar
      .filter((f) => f.datos)
      .map((f) => valoresCliente(f.datos!));

    if (nuevos.length) {
      await tx.insert(clientes).values(nuevos);
      insertados = nuevos.length;
    }

    for (const f of aActualizar) {
      if (!f.datos) continue;
      await tx
        .update(clientes)
        .set(valoresCliente(f.datos))
        .where(eq(clientes.documento, f.documento));
      actualizados++;
    }

    return { insertados, actualizados };
  });

  return NextResponse.json({
    ...resumen,
    importado: true,
    insertados: escrito.insertados,
    actualizados: escrito.actualizados,
    saltados: siExiste === "saltar" ? existen.length : 0,
  });
}
