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
    // Las rutas de API responden con 401, NO con una redirección.
    //
    // `fetch` sigue las redirecciones sin avisar: el navegador recibiría el
    // HTML del login con estado 200, `res.ok` sería verdadero y el
    // `res.json()` de quien llamó reventaría con un error de parseo. Es lo
    // que pasa cada vez que caduca la sesión con la app abierta.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Tu sesión ha caducado. Vuelve a entrar." },
        { status: 401 }
      );
    }

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
