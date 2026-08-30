import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import NuevoClientePage from "./formulario";

/** Dar de alta clientes es de oficina. Ver la guarda de ../page.tsx. */
export default async function Page() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.rol === "tecnico") redirect("/mantenimientos");
  return <NuevoClientePage />;
}
