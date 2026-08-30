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

/**
 * Limite de intentos de login.
 *
 * Es la unica ruta de la aplicacion accesible sin sesion, y sin limite
 * permite probar contrasenas indefinidamente. Ademas bcrypt con coste 12
 * tarda unos 250 ms por intento: sin freno, la ruta es tambien un
 * amplificador de carga que cualquiera puede activar sin autenticarse.
 *
 * El estado vive en memoria del proceso: se pierde al reiniciar y no se
 * comparte entre instancias. Para una sola instancia basta. Si algun dia
 * esto escala a varias, tiene que mudarse a Postgres o Redis — un limite
 * por proceso con cuatro procesos son cuatro veces los intentos.
 */
const VENTANA_MS = 15 * 60_000;
const MAX_INTENTOS = 8;

const intentos = new Map<string, { n: number; hasta: number }>();

function limpiarCaducados() {
  // Sin esto el mapa crece sin tope: cada email probado deja su entrada.
  const ahora = Date.now();
  for (const [clave, e] of intentos) {
    if (ahora > e.hasta) intentos.delete(clave);
  }
}

function bloqueado(clave: string): number {
  const e = intentos.get(clave);
  if (!e || Date.now() > e.hasta) return 0;
  return e.n >= MAX_INTENTOS ? Math.ceil((e.hasta - Date.now()) / 60_000) : 0;
}

function anotarFallo(clave: string) {
  const e = intentos.get(clave);
  intentos.set(
    clave,
    e && Date.now() <= e.hasta
      ? { n: e.n + 1, hasta: e.hasta }
      : { n: 1, hasta: Date.now() + VENTANA_MS }
  );
}

/**
 * Hash con la forma correcta y coste 12 que no corresponde a ninguna
 * contrasena. Se verifica contra el cuando el email no existe, para que
 * las dos ramas tarden lo mismo.
 *
 * Sin esto, un email inexistente respondia sin llamar a bcrypt y uno
 * existente con contrasena mala tardaba ~250 ms mas: el mensaje de error
 * era el mismo, pero el reloj decia cuales existen.
 */
const HASH_SENUELO =
  "$2b$12$abcdefghijklmnopqrstuuKq0Zx1YQ4Z0J8mB1oQe9lXbYc5vN8xC";

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

  limpiarCaducados();

  // Se limita por email y por IP por separado: por email, para que nadie
  // machaque una cuenta concreta; por IP, para que probar mil emails
  // distintos desde el mismo sitio tampoco salga gratis.
  const claveEmail = `email:${email.toLowerCase()}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "desconocida";
  const claveIp = `ip:${ip}`;

  const esperaMin = Math.max(bloqueado(claveEmail), bloqueado(claveIp));
  if (esperaMin > 0) {
    return NextResponse.json(
      {
        error:
          `Demasiados intentos fallidos. Vuelve a probar en ${esperaMin} ` +
          `minuto${esperaMin === 1 ? "" : "s"}.`,
      },
      { status: 429, headers: { "Retry-After": String(esperaMin * 60) } }
    );
  }

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
  const credencialesInvalidas = () => {
    anotarFallo(claveEmail);
    anotarFallo(claveIp);
    return NextResponse.json(
      { error: "Email o contraseña incorrectos." },
      { status: 401 }
    );
  };

  if (!usuario || !usuario.activo) {
    // Se gasta el mismo tiempo que si existiera: ver HASH_SENUELO.
    await verificarPassword(password, HASH_SENUELO);
    return credencialesInvalidas();
  }

  const passwordOk = await verificarPassword(password, usuario.passwordHash);
  if (!passwordOk) {
    return credencialesInvalidas();
  }

  // Login correcto: se borra el contador para que un despiste previo no
  // penalice al siguiente intento legitimo.
  intentos.delete(claveEmail);
  intentos.delete(claveIp);

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
