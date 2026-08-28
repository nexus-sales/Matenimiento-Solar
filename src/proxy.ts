import { NextRequest, NextResponse } from "next/server";
import { modoPruebasActivo } from "@/lib/modo-pruebas";

// Comprobación ligera aquí: solo mira si existe la cookie de sesión.
// La validación real del JWT y del rol ocurre en cada API route / server
// component con obtenerSesion() — el proxy no puede usar `jose` con
// el runtime edge por defecto de forma sencilla, así que su trabajo es
// solo evitar que alguien sin cookie llegue a ver la interfaz.
const RUTAS_PUBLICAS = ["/login", "/api/auth/login"];

export function proxy(req: NextRequest) {
  // modoPruebasActivo() lanza si alguien lo deja activo en producción —
  // se comprueba en cada request para que ese guardián no se pueda evitar
  // arrancando el proceso una sola vez con la variable ya desactivada.
  if (modoPruebasActivo()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (RUTAS_PUBLICAS.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const tieneSesion = req.cookies.has("sesion");
  if (!tieneSesion) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
