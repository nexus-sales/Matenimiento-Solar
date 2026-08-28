import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conSesionRLS } from "@/db";
import { usuarios } from "@/db/schema";
import { eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { exigirAdmin } from "@/lib/permisos";
import { campoIsla } from "@/lib/esquemas";
import { validarDocumento } from "@/lib/validacion";

const esquemaActualizar = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["admin", "oficina", "tecnico"]).optional(),
  // Opcional, pero si viene tiene que ser un documento real: aparece en
  // las actas firmadas.
  documento: z
    .union([
      z.string().transform((v) => v.trim().toUpperCase()).refine(validarDocumento, "Documento inválido."),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => v || null),
  isla: campoIsla,
  activo: z.boolean().optional(),
  password: z.string().min(8).optional(), // opcional: solo si se resetea
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const denegado = exigirAdmin(sesion);
  if (denegado) return denegado;

  const { id } = await params;

  // Un admin no puede quitarse a sí mismo el rol de admin ni desactivarse
  // por error — evita que la última cuenta de administrador quede bloqueada.
  if (id === sesion.id) {
    const body = await req.json();
    if (body.rol && body.rol !== "admin") {
      return NextResponse.json(
        { error: "No puedes cambiar tu propio rol de administrador." },
        { status: 400 }
      );
    }
    if (body.activo === false) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propia cuenta." },
        { status: 400 }
      );
    }
    return aplicarCambios(sesion, id, body);
  }

  const body = await req.json();
  return aplicarCambios(sesion, id, body);
}

async function aplicarCambios(
  sesion: NonNullable<Awaited<ReturnType<typeof obtenerSesion>>>,
  id: string,
  body: unknown
) {
  const parseo = esquemaActualizar.safeParse(body);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalle: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const d = parseo.data;
  const cambios: Record<string, unknown> = {};
  if (d.nombre !== undefined) cambios.nombre = d.nombre;
  if (d.rol !== undefined) cambios.rol = d.rol;
  if (d.isla !== undefined) cambios.isla = d.isla || null;
  if (d.documento !== undefined) cambios.documento = d.documento;
  if (d.activo !== undefined) cambios.activo = d.activo;
  if (d.password) cambios.passwordHash = await hashPassword(d.password);

  const [actualizado] = await conSesionRLS(sesion, (tx) =>
    tx
      .update(usuarios)
      .set(cambios)
      .where(eq(usuarios.id, id))
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

  if (!actualizado) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json(actualizado);
}
