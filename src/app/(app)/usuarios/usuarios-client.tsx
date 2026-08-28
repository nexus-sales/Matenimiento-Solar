"use client";

import { useEffect, useState, useCallback } from "react";
import { leerErrorApi } from "@/lib/errores-api";
import { SelectIsla } from "../componentes/select-isla";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "oficina" | "tecnico";
  isla: string | null;
  activo: boolean;
};

const ROL_LABEL: Record<Usuario["rol"], string> = {
  admin: "Admin",
  oficina: "Oficina",
  tecnico: "Técnico",
};

export default function UsuariosClient() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "tecnico" as Usuario["rol"],
    isla: "",
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsuarios(await res.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        isla: form.rol === "tecnico" ? form.isla || null : null,
      }),
    });

    setGuardando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo crear el usuario."));
      return;
    }

    setForm({ nombre: "", email: "", password: "", rol: "tecnico", isla: "" });
    setMostrarForm(false);
    cargar();
  }

  async function cambiarActivo(u: Usuario, activo: boolean) {
    setError(null);
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo actualizar."));
      return;
    }
    cargar();
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="text-sm bg-acento text-acento-encima rounded hover:bg-acento-hover px-3 py-1.5"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo usuario"}
        </button>
      </div>

      {error && <p className="text-sm text-peligro mb-3">{error}</p>}

      {mostrarForm && (
        <form
          onSubmit={crear}
          className="rounded-lg border border-borde bg-superficie p-4 mb-6 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-suave mb-1">
                Nombre *
              </label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-suave mb-1">
                Email *
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-suave mb-1">
                Contraseña inicial *
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-suave mb-1">Rol *</label>
              <select
                value={form.rol}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rol: e.target.value as Usuario["rol"],
                  })
                }
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              >
                <option value="tecnico">Técnico</option>
                <option value="oficina">Oficina</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.rol === "tecnico" && (
              <div>
                <label className="block text-xs text-suave mb-1">
                  Isla
                </label>
                <SelectIsla
                  value={form.isla}
                  onChange={(isla) => setForm({ ...form, isla })}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="text-sm bg-acento text-acento-encima rounded hover:bg-acento-hover px-3 py-1.5 disabled:opacity-50"
          >
            {guardando ? "Creando…" : "Crear usuario"}
          </button>
        </form>
      )}

      {cargando ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : (
        <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="p-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {u.nombre}{" "}
                  {!u.activo && (
                    <span className="text-xs text-tenue">(inactivo)</span>
                  )}
                </p>
                <p className="text-xs text-suave">
                  {u.email} · {ROL_LABEL[u.rol]}
                  {u.isla ? ` · ${u.isla}` : ""}
                </p>
              </div>
              <button
                onClick={() => cambiarActivo(u, !u.activo)}
                className="text-xs border rounded px-2 py-1 flex-shrink-0"
              >
                {u.activo ? "Desactivar" : "Reactivar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
