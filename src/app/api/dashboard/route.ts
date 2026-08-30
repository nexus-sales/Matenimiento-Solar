import { NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { clientes, intervenciones, usuarios } from "@/db/schema";
import { and, count, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";

/**
 * Indicadores de la pantalla de inicio. Solo lectura: no escribe nada y no
 * añade reglas de negocio nuevas — se limita a contar lo que ya hay.
 *
 * Las cifras salen filtradas por RLS igual que cualquier otra consulta: un
 * técnico ve el recuento de SUS visitas, no el de toda la empresa. Es el
 * comportamiento correcto, no un efecto secundario a corregir.
 */

function aFechaISO(fecha: Date): string {
  // Las columnas `fecha_prevista` / `fecha_ejecucion` son DATE, así que se
  // comparan como "YYYY-MM-DD" y no como timestamp. Se formatea con las
  // partes locales y no con toISOString(), que en horario de verano
  // canario devolvería el día anterior para una medianoche local.
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const ahora = new Date();
  const hoy = aFechaISO(ahora);
  const inicioDeMes = aFechaISO(
    new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  );
  const dentroDeTreintaDias = aFechaISO(
    new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 30)
  );

  const indicadores = await conSesionRLS(sesion, async (tx) => {
    const [totalClientes] = await tx.select({ n: count() }).from(clientes);
    // Clientes con mantenimiento contratado: son los que entran en la
    // planificación de visitas, y por tanto la cifra que importa.
    const [conMantenimiento] = await tx
      .select({ n: count() })
      .from(clientes)
      .where(eq(clientes.tieneMantenimiento, true));

    const [pendientes] = await tx
      .select({ n: count() })
      .from(intervenciones)
      .where(isNull(intervenciones.fechaEjecucion));

    const [vencidos] = await tx
      .select({ n: count() })
      .from(intervenciones)
      .where(
        and(
          isNull(intervenciones.fechaEjecucion),
          lt(intervenciones.fechaPrevista, hoy)
        )
      );

    const [completadosEsteMes] = await tx
      .select({ n: count() })
      .from(intervenciones)
      .where(
        and(
          gte(intervenciones.fechaEjecucion, inicioDeMes),
          lte(intervenciones.fechaEjecucion, hoy)
        )
      );

    const [tecnicosActivos] = await tx
      .select({ n: count() })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "tecnico"), eq(usuarios.activo, true)));

    const [sinTecnicoAsignado] = await tx
      .select({ n: count() })
      .from(intervenciones)
      .where(
        and(
          isNull(intervenciones.fechaEjecucion),
          isNull(intervenciones.tecnicoId)
        )
      );

    const [previstosTreintaDias] = await tx
      .select({ n: count() })
      .from(intervenciones)
      .where(
        and(
          isNull(intervenciones.fechaEjecucion),
          gte(intervenciones.fechaPrevista, hoy),
          lte(intervenciones.fechaPrevista, dentroDeTreintaDias)
        )
      );

    return {
      clientes: totalClientes.n,
      conMantenimiento: conMantenimiento.n,
      pendientes: pendientes.n,
      vencidos: vencidos.n,
      completadosEsteMes: completadosEsteMes.n,
      tecnicosActivos: tecnicosActivos.n,
      sinTecnicoAsignado: sinTecnicoAsignado.n,
      previstosTreintaDias: previstosTreintaDias.n,
    };
  });

  return NextResponse.json(indicadores);
}
