import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import { usuarios } from "@/db/schema";
import { obtenerSesion, tieneRol } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { exigirAdmin } from "@/lib/permisos";
import { campoDocumentoOpcional, campoIsla } from "@/lib/esquemas";

const esquemaUsuario = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(200),
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres."),
  rol: z.enum(["admin", "oficina", "tecnico"]),
  // Si viene tiene que ser un documento real: aparece en las actas firmadas.
  documento: campoDocumentoOpcional,
  isla: campoIsla,
});

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Listar el personal no es trabajo de campo. Antes bastaba con tener
  // sesión, así que un técnico podía descargarse el correo y el DNI de toda
  // la plantilla — el mismo fallo que se corrigió en la cartera de clientes,
  // en la tabla de al lado.
  //
  // Oficina sí lo necesita: es quien asigna las visitas. Pero para eso le
  // basta con el nombre y la isla, no con el documento de identidad.
  if (!tieneRol(sesion, ["admin", "oficina"])) {
    return NextResponse.json(
      { error: "No tienes permiso para ver el personal." },
      { status: 403 }
    );
  }

  const esAdmin = sesion.rol === "admin";

  const resultado = await conSesionRLS(sesion, (tx) =>
    tx
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        rol: usuarios.rol,
        isla: usuarios.isla,
        activo: usuarios.activo,
        // Solo administración, que es quien gestiona las altas y los
        // permisos. El documento aparece en las actas firmadas, así que es
        // un dato personal de un empleado, no un identificador de trabajo.
        ...(esAdmin
          ? {
              email: usuarios.email,
              documento: usuarios.documento,
              veTodosClientes: usuarios.veTodosClientes,
              creadoEn: usuarios.creadoEn,
            }
          : {}),
      })
      .from(usuarios)
      .orderBy(usuarios.nombre)
  );

  return NextResponse.json(resultado);
}

export async function POST(req: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const denegado = exigirAdmin(sesion);
  if (denegado) return denegado;

  const body = await req.json();
  const parseo = esquemaUsuario.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const d = parseo.data;

  if (d.rol !== "tecnico" && d.isla) {
    return NextResponse.json(
      { error: "La isla solo aplica a usuarios con rol técnico." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await hashPassword(d.password);

    const [creado] = await conSesionRLS(sesion, (tx) =>
      tx
        .insert(usuarios)
        .values({
          nombre: d.nombre,
          email: d.email,
          passwordHash,
          rol: d.rol,
          documento: d.documento,
          isla: d.rol === "tecnico" ? d.isla || null : null,
        })
        .returning({
          id: usuarios.id,
          nombre: usuarios.nombre,
          email: usuarios.email,
          rol: usuarios.rol,
          documento: usuarios.documento,
        isla: usuarios.isla,
          activo: usuarios.activo,
        })
    );
    return NextResponse.json(creado, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email." },
        { status: 409 }
      );
    }
    throw err;
  }
}
