import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import FormulariosClient from "./formularios-client";

export default async function FormulariosPage() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") {
    redirect("/");
  }
  return <FormulariosClient />;
}
