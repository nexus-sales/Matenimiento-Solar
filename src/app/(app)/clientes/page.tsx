"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { leerErrorApi } from "@/lib/errores-api";
import { ISLAS_CANARIAS } from "@/lib/islas";

type Cliente = {
  id: string;
  nombre: string;
  documento: string;
  telefono: string | null;
  isla: string | null;
  poblacion: string | null;
  cups: string | null;
  potenciaNominal: string | null;
  tieneMantenimiento: boolean;
};

export default function ClientesPage() {
  // useSearchParams obliga a un límite de Suspense: la página se sirve bajo
  // demanda, pero Next lo exige igualmente para poder streamear el resto.
  return (
    <Suspense fallback={<p className="p-8 text-sm text-suave">Cargando…</p>}>
      <ListaClientes />
    </Suspense>
  );
}

function ListaClientes() {
  // Los filtros pueden venir en la URL: así el indicador "Con mantenimiento"
  // del dashboard enlaza directamente al listado ya filtrado.
  const params = useSearchParams();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [isla, setIsla] = useState(() => params.get("isla") ?? "");
  const [mantenimiento, setMantenimiento] = useState(
    () => params.get("mantenimiento") ?? ""
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (busqueda: string, islaFiltro: string, mantFiltro: string) => {
      setCargando(true);

      const params = new URLSearchParams();
      if (busqueda) params.set("q", busqueda);
      if (islaFiltro) params.set("isla", islaFiltro);
      if (mantFiltro) params.set("mantenimiento", mantFiltro);
      const cadena = params.toString();

      const res = await fetch(`/api/clientes${cadena ? `?${cadena}` : ""}`);
      if (res.ok) {
        setClientes(await res.json());
        setError(null);
      } else {
        // Un fallo al listar no puede quedarse en "no hay clientes todavía":
        // son dos situaciones distintas y hay que poder distinguirlas.
        setError(
          await leerErrorApi(res, "No se pudo cargar la lista de clientes.")
        );
      }
      setCargando(false);
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => cargar(q, isla, mantenimiento), 300);
    return () => clearTimeout(t);
  }, [q, isla, mantenimiento, cargar]);

  const hayFiltros = Boolean(q || isla || mantenimiento);

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="rounded bg-acento px-3 py-1.5 text-sm text-acento-encima hover:bg-acento-hover"
        >
          + Nuevo cliente
        </Link>
      </div>
      <p className="mb-5 text-sm text-suave">
        La ficha de cliente contiene todos sus datos. Los mantenimientos y
        las obras se apoyan en ella.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          placeholder="Buscar por nombre, documento, CUPS o dirección…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-md border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none sm:col-span-2"
        />
        <select
          value={isla}
          onChange={(e) => setIsla(e.target.value)}
          className="rounded-md border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
        >
          <option value="">Todas las islas</option>
          {ISLAS_CANARIAS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          value={mantenimiento}
          onChange={(e) => setMantenimiento(e.target.value)}
          className="rounded-md border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
        >
          <option value="">Mantenimiento: todos</option>
          <option value="si">Con mantenimiento</option>
          <option value="no">Sin mantenimiento</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-suave">
          {hayFiltros
            ? "Ningún cliente coincide con la búsqueda."
            : "No hay clientes todavía."}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-tenue">
            {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
          </p>
          <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="block p-3 hover:bg-superficie-alt"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-texto">
                    {c.nombre}
                  </p>
                  {c.tieneMantenimiento && (
                    <span className="shrink-0 rounded-full bg-acento-suave px-2 py-0.5 text-xs text-acento-contraste">
                      Mantenimiento
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-suave">
                  {[c.documento, c.poblacion, c.isla, c.telefono]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-0.5 font-mono text-xs text-tenue">
                  {c.cups ?? "Sin CUPS"}
                  {c.potenciaNominal ? ` · ${c.potenciaNominal} kW` : ""}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
