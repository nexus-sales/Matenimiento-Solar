import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import ImportarClientesPage from "./formulario";

/** Importar la cartera es de oficina. Ver la guarda de ../page.tsx. */
export default async function Page() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.rol === "tecnico") redirect("/mantenimientos");
  return <ImportarClientesPage />;
}
