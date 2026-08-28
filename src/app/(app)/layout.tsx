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
      {/* El desplazamiento lo calcula el CSS a partir de data-sidebar; ver
          .contenido-app en globals.css. */}
      <div className="contenido-app">{children}</div>
    </div>
  );
}
