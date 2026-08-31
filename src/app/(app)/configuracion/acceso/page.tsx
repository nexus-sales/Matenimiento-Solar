import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import AccesoClient from "./acceso-client";

export default async function AccesoPage() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") {
    redirect("/");
  }
  return <AccesoClient />;
}
