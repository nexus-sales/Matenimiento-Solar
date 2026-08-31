"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "oficina" | "tecnico";
  isla: string | null;
  veTodosClientes: boolean;
  activo: boolean;
};

export default function AccesoClient() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/usuarios");
    if (res.ok) {
      setUsuarios(await res.json());
      setError(null);
    } else {
      setError(await leerErrorApi(res, "No se pudieron cargar los usuarios."));
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  async function cambiar(u: Usuario, veTodos: boolean) {
    setGuardando(u.id);
    setError(null);

    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ veTodosClientes: veTodos }),
    });

    setGuardando(null);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo cambiar el permiso."));
      return;
    }
    cargar();
  }

  // Solo los técnicos: oficina y administración ya ven la cartera entera por
  // su propio rol, y ofrecerles el interruptor sugeriría que cambia algo.
  const tecnicos = usuarios.filter((u) => u.rol === "tecnico");
  const conAcceso = tecnicos.filter((u) => u.veTodosClientes).length;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <Link href="/configuracion" className="text-sm text-suave">
        ← Configuración
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Acceso a los clientes</h1>
      <p className="mt-1 text-sm text-suave">
        De forma predeterminada un técnico solo ve los clientes de las visitas
        que tiene asignadas. Los datos que necesita para trabajar le llegan
        dentro de la propia visita.
      </p>

      <div className="mt-4 rounded-lg border border-borde bg-superficie-alt p-4 text-sm text-suave">
        La lista completa de clientes —con sus documentos, direcciones y
        teléfonos— es el activo del negocio. Da acceso solo a quien lo necesite
        de verdad para trabajar, no por comodidad.
        <span className="mt-2 block text-xs text-tenue">
          La regla la aplica la base de datos, no la pantalla: un técnico sin
          este permiso no puede leer esas fichas ni escribiendo la dirección a
          mano. Y quitarlo tiene efecto de inmediato, no cuando caduque su
          sesión.
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-suave">Cargando…</p>
      ) : tecnicos.length === 0 ? (
        <p className="mt-6 rounded-lg border border-borde bg-superficie p-6 text-sm text-suave">
          No hay técnicos dados de alta. Créalos en{" "}
          <Link href="/usuarios" className="underline">
            Usuarios
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-6 mb-2 text-sm text-suave">
            {conAcceso === 0
              ? `${tecnicos.length} técnico${tecnicos.length === 1 ? "" : "s"}, ninguno con acceso a la cartera completa.`
              : `${conAcceso} de ${tecnicos.length} con acceso a la cartera completa.`}
          </p>

          <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
            {tecnicos.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-texto">
                    {u.nombre}
                    {!u.activo && (
                      <span className="ml-2 text-xs text-tenue">(inactivo)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-suave">
                    {u.email}
                    {u.isla ? ` · ${u.isla}` : ""}
                  </p>
                </div>

                <label className="flex shrink-0 items-center gap-2 text-sm text-suave">
                  <input
                    type="checkbox"
                    checked={u.veTodosClientes}
                    disabled={guardando === u.id}
                    onChange={(e) => cambiar(u, e.target.checked)}
                    className="accent-acento"
                  />
                  Ve todos los clientes
                </label>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
