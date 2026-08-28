import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import SidebarCliente from "./sidebar-cliente";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-fondo">
      <SidebarCliente nombre={sesion.nombre} rol={sesion.rol} />
      {/* El sidebar es fijo, así que el contenido se desplaza su ancho. */}
      <div className="pl-60">{children}</div>
    </div>
  );
}
