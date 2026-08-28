import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbAuthService } from "@/db";
import { usuarios } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verificarPassword, crearSesion } from "@/lib/auth";

const esquemaLogin = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parseo = esquemaLogin.safeParse(body);

  if (!parseo.success) {
    return NextResponse.json(
      { error: "Email o contraseña con formato inválido." },
      { status: 400 }
    );
  }

  const { email, password } = parseo.data;

  // Antes de autenticar no hay sesión que las políticas RLS puedan exigir,
  // así que este único paso usa dbAuthService (rol de Postgres aparte con
  // BYPASSRLS, ver src/db/index.ts y src/db/rls.sql).
  //
  // Las columnas se piden UNA A UNA a propósito. Ese rol solo tiene permiso
  // sobre las seis de aquí abajo; un `select *` intentaría leer también
  // `isla` y `creado_en`, y Postgres respondería con un error de permisos
  // que llega al navegador como un 500 en vez de como un login fallido.
  const [usuario] = await dbAuthService
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      passwordHash: usuarios.passwordHash,
      rol: usuarios.rol,
      activo: usuarios.activo,
    })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  // Mismo mensaje de error tanto si el email no existe como si la
  // contraseña es incorrecta — no dar pistas de qué falló.
  const credencialesInvalidas = () =>
    NextResponse.json(
      { error: "Email o contraseña incorrectos." },
      { status: 401 }
    );

  if (!usuario || !usuario.activo) {
    return credencialesInvalidas();
  }

  const passwordOk = await verificarPassword(password, usuario.passwordHash);
  if (!passwordOk) {
    return credencialesInvalidas();
  }

  await crearSesion({
    id: usuario.id,
    rol: usuario.rol,
    nombre: usuario.nombre,
  });

  return NextResponse.json({
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
  });
}
