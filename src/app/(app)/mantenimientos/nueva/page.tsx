"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { leerErrorApi } from "@/lib/errores-api";
import { NOMBRE_TIPO_VISITA, TIPOS_VISITA, type TipoVisita } from "@/lib/checklist";

type Cliente = {
  id: string;
  nombre: string;
  documento: string;
  isla: string | null;
  tieneMantenimiento: boolean;
};

type Tecnico = { id: string; nombre: string; isla: string | null; rol: string; activo: boolean };

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default function NuevaVisitaPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-suave">Cargando…</p>}>
      <FormularioNuevaVisita />
    </Suspense>
  );
}

function FormularioNuevaVisita() {
  const router = useRouter();
  const params = useSearchParams();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    clienteId: params.get("cliente") ?? "",
    tipo: "anual" as TipoVisita,
    fechaPrevista: hoyISO(),
    tecnicoId: "",
  });

  useEffect(() => {
    // Solo se listan clientes con mantenimiento contratado: son los únicos
    // a los que tiene sentido programarles una visita, y la API lo rechaza
    // igualmente si se intenta con otro.
    async function cargar() {
      const [resClientes, resTecnicos] = await Promise.all([
        fetch("/api/clientes?mantenimiento=si"),
        fetch("/api/usuarios"),
      ]);

      if (resClientes.ok) setClientes(await resClientes.json());
      else setError(await leerErrorApi(resClientes, "No se pudieron cargar los clientes."));

      // El listado de usuarios es solo para admin; si no llega, se sigue
      // pudiendo programar la visita y asignarla después desde la lista.
      if (resTecnicos.ok) {
        const todos: Tecnico[] = await resTecnicos.json();
        setTecnicos(todos.filter((u) => u.rol === "tecnico" && u.activo));
      }
      setCargando(false);
    }
    cargar();
  }, []);

  const cliente = clientes.find((c) => c.id === form.clienteId);

  // Se sugiere el técnico de la isla del cliente, pero no se impone: un
  // desplazamiento entre islas es raro, no imposible.
  const tecnicosDeLaIsla = cliente?.isla
    ? tecnicos.filter((t) => t.isla === cliente.isla)
    : tecnicos;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = await fetch("/api/mantenimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: form.clienteId,
        tipo: form.tipo,
        fechaPrevista: form.fechaPrevista,
        tecnicoId: form.tecnicoId || null,
      }),
    });

    setGuardando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo programar la visita."));
      return;
    }

    const creada = await res.json();
    router.push(`/mantenimientos/${creada.id}`);
  }

  const claseCampo =
    "w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none";

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <Link href="/mantenimientos" className="text-sm text-suave">
        ← Mantenimientos
      </Link>
      <h1 className="mb-5 mt-2 text-xl font-semibold">Programar visita</h1>

      {cargando ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : (
        <form
          onSubmit={crear}
          className="space-y-4 rounded-lg border border-borde bg-superficie p-5"
        >
          <div>
            <label className="mb-1 block text-xs text-suave">Cliente *</label>
            <select
              required
              value={form.clienteId}
              onChange={(e) =>
                setForm({ ...form, clienteId: e.target.value, tecnicoId: "" })
              }
              className={claseCampo}
            >
              <option value="">— Selecciona cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.documento}
                  {c.isla ? ` · ${c.isla}` : ""}
                </option>
              ))}
            </select>
            {clientes.length === 0 && (
              <p className="mt-1 text-xs text-tenue">
                No hay clientes con mantenimiento contratado. Actívalo en la
                ficha del cliente.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-suave">
                Tipo de visita
              </label>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as TipoVisita })
                }
                className={claseCampo}
              >
                {TIPOS_VISITA.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_TIPO_VISITA[t]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-tenue">
                {form.tipo === "semestral"
                  ? "Solo los puntos de periodicidad semestral."
                  : "El checklist completo."}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-suave">
                Fecha prevista *
              </label>
              <input
                type="date"
                required
                value={form.fechaPrevista}
                onChange={(e) =>
                  setForm({ ...form, fechaPrevista: e.target.value })
                }
                className={claseCampo}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-suave">Técnico</label>
            <select
              value={form.tecnicoId}
              onChange={(e) => setForm({ ...form, tecnicoId: e.target.value })}
              className={claseCampo}
            >
              <option value="">— Sin asignar todavía —</option>
              {tecnicosDeLaIsla.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {t.isla ? ` · ${t.isla}` : ""}
                </option>
              ))}
            </select>
            {cliente?.isla && tecnicosDeLaIsla.length === 0 && (
              <p className="mt-1 text-xs text-aviso-contraste">
                No hay técnicos asignados a {cliente.isla}.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-borde pt-4">
            <button
              type="submit"
              disabled={guardando || !form.clienteId}
              className="rounded bg-acento px-4 py-2 text-sm text-acento-encima hover:bg-acento-hover disabled:opacity-50"
            >
              {guardando ? "Programando…" : "Programar visita"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/mantenimientos")}
              className="rounded border border-borde-fuerte px-4 py-2 text-sm text-medio hover:bg-superficie-alt"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
