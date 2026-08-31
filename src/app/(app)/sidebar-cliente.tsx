"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SelectorTema from "./componentes/selector-tema";

type Modulo = {
  href: string;
  etiqueta: string;
  soloAdmin?: boolean;
  /** Admin y oficina, no el técnico. */
  soloOficina?: boolean;
  icono: React.ReactNode;
};

const CLAVE_PLEGADO = "sr-sidebar-plegado";

function Icono({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-5 w-5 shrink-0"
    >
      {children}
    </svg>
  );
}

const MODULOS: Modulo[] = [
  {
    href: "/dashboard",
    etiqueta: "Dashboard",
    icono: (
      <Icono>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </Icono>
    ),
  },
  {
    href: "/clientes",
    etiqueta: "Clientes",
    // El técnico ya no lista la cartera (ver /api/clientes): los datos del
    // cliente le llegan dentro de su visita. Sin esto el enlace seguiría en
    // el menú y respondería 403 al pulsarlo.
    soloOficina: true,
    icono: (
      <Icono>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </Icono>
    ),
  },
  {
    href: "/mantenimientos",
    etiqueta: "Mantenimientos",
    icono: (
      <Icono>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </Icono>
    ),
  },
  {
    // Usuarios pasa a vivir dentro de Configuración: es una de las cosas
    // que solo toca administración, no un módulo de trabajo diario.
    href: "/configuracion",
    etiqueta: "Configuración",
    soloAdmin: true,
    icono: (
      <Icono>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </Icono>
    ),
  },
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

  // Dos estados distintos, no uno:
  //   `abierto`  — en móvil el panel se superpone. Se cierra al navegar.
  //   `plegado`  — en escritorio se encoge a solo iconos. Es una preferencia
  //                y se recuerda; en móvil no aplica.
  const [abierto, setAbierto] = useState(false);
  const [plegado, setPlegado] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlegado(localStorage.getItem(CLAVE_PLEGADO) === "si");
    } catch {
      // Almacenamiento bloqueado: se queda desplegado, que es lo esperable.
    }
  }, []);

  // El desplazamiento del contenido se resuelve en CSS a partir de este
  // atributo, igual que el tema. Así el layout no necesita ser cliente ni
  // recibir el estado por props.
  useEffect(() => {
    document.documentElement.dataset.sidebar = plegado ? "plegado" : "abierto";
  }, [plegado]);

  function alternarPlegado() {
    const nuevo = !plegado;
    setPlegado(nuevo);
    try {
      localStorage.setItem(CLAVE_PLEGADO, nuevo ? "si" : "no");
    } catch {
      // Si no se puede recordar, vale para esta sesión.
    }
  }

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

  const visibles = MODULOS.filter(
    (m) =>
      (!m.soloAdmin || rol === "admin") &&
      (!m.soloOficina || rol === "admin" || rol === "oficina")
  );
  const ancho = plegado ? "lg:w-16" : "lg:w-60";

  return (
    <>
      {/* Barra superior: solo en móvil y tablet. En escritorio el panel
          está siempre a la vista y esta barra sobra. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-borde bg-superficie px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-borde text-medio"
        >
          <Icono>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </Icono>
        </button>
        <span aria-hidden className="h-5 w-1.5 rounded-full bg-marca" />
        <span className="text-sm font-semibold tracking-tight text-texto">
          SR Energía
        </span>
      </header>

      {/* Velo del panel móvil. Cubre el contenido y lo cierra al tocar. */}
      {abierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-30 bg-texto/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-borde bg-superficie transition-transform duration-200 lg:z-10 lg:translate-x-0 lg:transition-[width] ${ancho} ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className={`flex items-center gap-2.5 py-5 ${plegado ? "lg:justify-center lg:px-0" : "px-5"}`}
        >
          <span aria-hidden className="h-7 w-2 shrink-0 rounded-full bg-marca" />
          <span
            className={`text-sm font-semibold tracking-tight text-texto ${plegado ? "lg:hidden" : ""}`}
          >
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
                // En móvil el panel se superpone al contenido: al elegir
                // destino estorba, así que se cierra al pulsar. Se hace en el
                // evento y no reaccionando a la ruta, que sería estado
                // derivado de estado.
                onClick={() => setAbierto(false)}
                // El título solo aporta plegado, cuando no se lee la etiqueta.
                title={plegado ? modulo.etiqueta : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  plegado ? "lg:justify-center lg:px-0" : ""
                } ${
                  activo
                    ? "bg-acento-suave font-medium text-acento-contraste"
                    : "text-medio hover:bg-superficie-alt hover:text-texto"
                }`}
              >
                {modulo.icono}
                <span className={plegado ? "lg:hidden" : ""}>
                  {modulo.etiqueta}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className={`pb-2 ${plegado ? "lg:px-2" : "px-3"}`}>
          <Link
            href="/ayuda"
            aria-current={ruta === "/ayuda" ? "page" : undefined}
            onClick={() => setAbierto(false)}
            title={plegado ? "Ayuda" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
              plegado ? "lg:justify-center lg:px-0" : ""
            } ${
              ruta === "/ayuda"
                ? "bg-acento-suave font-medium text-acento-contraste"
                : "text-medio hover:bg-superficie-alt hover:text-texto"
            }`}
          >
            <Icono>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </Icono>
            <span className={plegado ? "lg:hidden" : ""}>Ayuda</span>
          </Link>
        </div>

        <div className={`pb-3 ${plegado ? "lg:px-2" : "px-3"}`}>
          <SelectorTema compacto={plegado} />
        </div>

        <div
          className={`border-t border-borde py-4 ${plegado ? "lg:px-2" : "px-5"}`}
        >
          <div className={plegado ? "lg:hidden" : ""}>
            <p className="truncate text-sm font-medium text-texto">{nombre}</p>
            <p className="text-xs text-suave">{NOMBRE_ROL[rol] ?? rol}</p>
          </div>
          <button
            onClick={salir}
            title={plegado ? "Cerrar sesión" : undefined}
            className={`mt-3 flex items-center gap-2 text-xs text-suave underline-offset-2 hover:text-aviso-contraste hover:underline ${
              plegado ? "lg:mt-0 lg:w-full lg:justify-center" : ""
            }`}
          >
            <Icono>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </Icono>
            <span className={plegado ? "lg:hidden" : ""}>Cerrar sesión</span>
          </button>
        </div>

        {/* Plegar es solo de escritorio: en móvil el panel se cierra entero. */}
        <button
          type="button"
          onClick={alternarPlegado}
          aria-label={plegado ? "Expandir menú" : "Contraer menú"}
          className="hidden border-t border-borde py-2 text-tenue hover:text-medio lg:flex lg:items-center lg:justify-center"
        >
          <Icono>
            {plegado ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </Icono>
        </button>
      </aside>
    </>
  );
}
