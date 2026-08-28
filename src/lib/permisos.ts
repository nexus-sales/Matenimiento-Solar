import { NextResponse } from "next/server";
import { SesionPayload } from "./auth";

/**
 * RLS ya impide que un técnico escriba en la ficha de clientes — esto es
 * defensa en profundidad para devolver un 403 con mensaje claro en vez de
 * dejar que la query falle más abajo con un error de Postgres genérico.
 */
export function exigirRolEscritura(sesion: SesionPayload) {
  if (sesion.rol !== "admin" && sesion.rol !== "oficina") {
    return NextResponse.json(
      { error: "No tienes permiso para modificar este recurso." },
      { status: 403 }
    );
  }
  return null;
}

export function exigirAdmin(sesion: SesionPayload) {
  if (sesion.rol !== "admin") {
    return NextResponse.json(
      { error: "Esta acción requiere rol de administrador." },
      { status: 403 }
    );
  }
  return null;
}
