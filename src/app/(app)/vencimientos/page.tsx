import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import VencimientosClient from "./vencimientos-client";

/**
 * Planificación: a quién le toca revisión.
 *
 * Solo oficina y administración. El técnico ejecuta lo que le asignan, y
 * enseñarle esta pantalla supondría enseñarle la cartera entera — justo lo
 * que la política de clientes evita.
 */
export default async function VencimientosPage() {
  const sesion = await obtenerSesion();
  if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "oficina")) {
    redirect("/");
  }
  return <VencimientosClient />;
}
