import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { clientes } from "@/db/schema";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { obtenerSesion, tieneRol } from "@/lib/auth";
import { esquemaCliente, valoresCliente } from "@/lib/esquemas";
import { ISLAS_CANARIAS, type IslaCanaria } from "@/lib/islas";
import { errorDeDuplicado } from "@/lib/conflictos";

/**
 * Listado de clientes. Búsqueda libre por nombre, documento, CUPS o
 * dirección, más filtros opcionales por isla (`?isla=`) y por si tienen
 * mantenimiento contratado (`?mantenimiento=si|no`).
 */
export async function GET(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const islaFiltro = params.get("isla")?.trim();
  const mantenimientoFiltro = params.get("mantenimiento")?.trim();

  const condiciones: SQL[] = [];

  if (q) {
    const busqueda = or(
      ilike(clientes.nombre, `%${q}%`),
      ilike(clientes.documento, `%${q}%`),
      ilike(clientes.cups, `%${q}%`),
      ilike(clientes.direccion, `%${q}%`)
    );
    if (busqueda) condiciones.push(busqueda);
  }

  // La isla llega de un desplegable, pero el filtro se compara contra una
  // columna de tipo enum: un valor fuera de la lista haría fallar la
  // consulta en Postgres, así que se descarta antes de llegar a ella.
  if (islaFiltro && ISLAS_CANARIAS.includes(islaFiltro as IslaCanaria)) {
    condiciones.push(eq(clientes.isla, islaFiltro as IslaCanaria));
  }

  if (mantenimientoFiltro === "si" || mantenimientoFiltro === "no") {
    condiciones.push(
      eq(clientes.tieneMantenimiento, mantenimientoFiltro === "si")
    );
  }

  const resultado = await conSesionRLS(sesion, (tx) =>
    tx
      .select()
      .from(clientes)
      .where(condiciones.length ? and(...condiciones) : undefined)
      .orderBy(asc(clientes.nombre))
  );

  return NextResponse.json(resultado);
}

export async function POST(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!tieneRol(sesion, ["admin", "oficina"])) {
    return NextResponse.json(
      { error: "No tienes permiso para crear clientes." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parseo = esquemaCliente.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const [creado] = await conSesionRLS(sesion, (tx) =>
      tx.insert(clientes).values(valoresCliente(parseo.data)).returning()
    );
    return NextResponse.json(creado, { status: 201 });
  } catch (err: unknown) {
    const conflicto = errorDeDuplicado(err);
    if (conflicto) return conflicto;
    throw err;
  }
}
