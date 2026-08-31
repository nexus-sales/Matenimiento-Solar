"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";
import { SelectIsla } from "../componentes/select-isla";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  documento: string | null;
  rol: "admin" | "oficina" | "tecnico";
  isla: string | null;
  activo: boolean;
};

const CLASE_CAMPO =
  "w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none";

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

  // Edición en línea: se despliega bajo el usuario elegido. Una pantalla
  // aparte para cuatro campos sería un rodeo.
  const [editando, setEditando] = useState<string | null>(null);
  const [edicion, setEdicion] = useState({
    nombre: "",
    documento: "",
    rol: "tecnico" as Usuario["rol"],
    isla: "",
  });

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    documento: "",
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
        documento: form.documento || null,
        isla: form.rol === "tecnico" ? form.isla || null : null,
      }),
    });

    setGuardando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo crear el usuario."));
      return;
    }

    setForm({
      nombre: "",
      email: "",
      documento: "",
      password: "",
      rol: "tecnico",
      isla: "",
    });
    setMostrarForm(false);
    cargar();
  }

  function empezarEdicion(u: Usuario) {
    setError(null);
    setEditando(u.id);
    setEdicion({
      nombre: u.nombre,
      documento: u.documento ?? "",
      rol: u.rol,
      isla: u.isla ?? "",
    });
  }

  async function guardarEdicion(id: string) {
    setError(null);
    setGuardando(true);

    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: edicion.nombre,
        documento: edicion.documento,
        rol: edicion.rol,
        // La isla solo aplica a técnicos; en otro rol se manda vacía para
        // que quede limpia si el usuario cambia de puesto.
        isla: edicion.rol === "tecnico" ? edicion.isla : "",
      }),
    });

    setGuardando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar el usuario."));
      return;
    }

    setEditando(null);
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
    <main className="max-w-5xl mx-auto p-4 sm:p-8">
      {/* La URL se queda en /usuarios: ya circulan enlaces a ella. Lo que
          cambia es dónde se entra, que ahora es Configuración. */}
      <Link href="/configuracion" className="text-sm text-suave">
        ← Configuración
      </Link>
      <div className="flex items-center justify-between mb-4 mt-2">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                Documento
              </label>
              <input
                value={form.documento}
                onChange={(e) =>
                  setForm({ ...form, documento: e.target.value.toUpperCase() })
                }
                placeholder="NIF, NIE o CIF"
                title="Aparece en las actas que firma este usuario"
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
            <div key={u.id}>
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium">
                  {u.nombre}{" "}
                  {!u.activo && (
                    <span className="text-xs text-tenue">(inactivo)</span>
                  )}
                </p>
                <p className="text-xs text-suave">
                  {[u.email, u.documento, ROL_LABEL[u.rol]]
                    .filter(Boolean)
                    .join(" · ")}
                  {u.isla ? ` · ${u.isla}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() =>
                    editando === u.id ? setEditando(null) : empezarEdicion(u)
                  }
                  className="rounded border border-borde-fuerte px-2 py-1 text-xs hover:bg-superficie-alt"
                >
                  {editando === u.id ? "Cancelar" : "Editar"}
                </button>
                <button
                  onClick={() => cambiarActivo(u, !u.activo)}
                  className="rounded border border-borde-fuerte px-2 py-1 text-xs hover:bg-superficie-alt"
                >
                  {u.activo ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </div>

            {editando === u.id && (
              <div className="border-t border-borde bg-superficie-alt p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-suave">
                      Nombre
                    </label>
                    <input
                      value={edicion.nombre}
                      onChange={(e) =>
                        setEdicion({ ...edicion, nombre: e.target.value })
                      }
                      className={CLASE_CAMPO}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-suave">
                      Documento
                    </label>
                    <input
                      value={edicion.documento}
                      onChange={(e) =>
                        setEdicion({
                          ...edicion,
                          documento: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="NIF, NIE o CIF"
                      className={CLASE_CAMPO}
                    />
                    <p className="mt-1 text-xs text-tenue">
                      Aparece en las actas que firma
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-suave">Rol</label>
                    <select
                      value={edicion.rol}
                      onChange={(e) =>
                        setEdicion({
                          ...edicion,
                          rol: e.target.value as Usuario["rol"],
                        })
                      }
                      className={CLASE_CAMPO}
                    >
                      <option value="tecnico">Técnico</option>
                      <option value="oficina">Oficina</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {edicion.rol === "tecnico" && (
                    <div>
                      <label className="mb-1 block text-xs text-suave">
                        Isla
                      </label>
                      <SelectIsla
                        value={edicion.isla}
                        onChange={(isla) => setEdicion({ ...edicion, isla })}
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => guardarEdicion(u.id)}
                  disabled={guardando}
                  className="mt-3 rounded bg-acento px-3 py-1.5 text-sm text-acento-encima hover:bg-acento-hover disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>
          ))}
        </div>
      )}
    </main>
  );
}
