import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import UsuariosClient from "./usuarios-client";

export default async function UsuariosPage() {
  const sesion = await obtenerSesion();
  // El layout de (app) ya exige sesión; aquí exigimos además el rol.
  // Redirige en vez de mostrar un 403 en blanco — más claro para alguien
  // que llegó aquí por un enlace viejo o escribiendo la URL a mano.
  if (!sesion || sesion.rol !== "admin") {
    redirect("/");
  }

  return <UsuariosClient />;
}
