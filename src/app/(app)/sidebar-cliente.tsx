"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SelectorTema from "./componentes/selector-tema";

type Modulo = {
  href: string;
  etiqueta: string;
  soloAdmin?: boolean;
};

const MODULOS: Modulo[] = [
  { href: "/dashboard", etiqueta: "Dashboard" },
  { href: "/clientes", etiqueta: "Clientes" },
  { href: "/mantenimientos", etiqueta: "Mantenimientos" },
  { href: "/usuarios", etiqueta: "Usuarios", soloAdmin: true },
];

const NOMBRE_ROL: Record<string, string> = {
  admin: "Administración",
  oficina: "Oficina",
  tecnico: "Técnico",
};

export default function SidebarCliente({
  nombre,
  rol,
}: {
  nombre: string;
  rol: string;
}) {
  const router = useRouter();
  const ruta = usePathname();

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Un módulo se marca activo también en sus subrutas (/clientes/[id]),
  // salvo el dashboard, que solo coincide de forma exacta.
  function estaActivo(href: string) {
    if (href === "/dashboard") return ruta === href;
    return ruta === href || ruta.startsWith(`${href}/`);
  }

  const visibles = MODULOS.filter((m) => !m.soloAdmin || rol === "admin");

  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-60 flex-col border-r border-borde bg-superficie">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span
          aria-hidden
          className="h-7 w-2 rounded-full bg-marca"
        />
        <span className="text-sm font-semibold tracking-tight text-texto">
          SR Energía
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {visibles.map((modulo) => {
          const activo = estaActivo(modulo.href);
          return (
            <Link
              key={modulo.href}
              href={modulo.href}
              aria-current={activo ? "page" : undefined}
              className={
                activo
                  ? "block rounded-md bg-acento-suave px-3 py-2 text-sm font-medium text-acento-contraste"
                  : "block rounded-md px-3 py-2 text-sm text-medio hover:bg-superficie-alt hover:text-texto"
              }
            >
              {modulo.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <SelectorTema />
      </div>

      <div className="border-t border-borde px-5 py-4">
        <p className="truncate text-sm font-medium text-texto">{nombre}</p>
        <p className="text-xs text-suave">{NOMBRE_ROL[rol] ?? rol}</p>
        <button
          onClick={salir}
          className="mt-3 text-xs text-suave underline-offset-2 hover:text-aviso-contraste hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
