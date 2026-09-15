"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";
import {
  NOMBRE_VENCIMIENTO,
  textoVencimiento,
  type EstadoVencimiento,
} from "@/lib/vencimientos";

type Fila = {
  id: string;
  nombre: string;
  isla: string | null;
  telefono: string | null;
  periodicidadMantenimiento: number | null;
  ultimaVisita: string | null;
  yaProgramada: boolean;
  estado: EstadoVencimiento;
  proxima: string | null;
  dias: number | null;
  origen: "ultima_visita" | "fecha_instalacion" | null;
};

const ESTILO: Record<EstadoVencimiento, string> = {
  vencido: "bg-peligro-suave text-peligro-contraste border-peligro-borde",
  proximo: "bg-aviso-suave text-aviso-contraste border-aviso",
  al_dia: "bg-acento-suave text-acento-contraste border-acento",
  sin_datos: "bg-superficie-fuerte text-tenue border-borde",
};

const FILTROS: { valor: EstadoVencimiento | "atencion"; etiqueta: string }[] = [
  { valor: "atencion", etiqueta: "Requieren atención" },
  { valor: "vencido", etiqueta: "Vencidos" },
  { valor: "proximo", etiqueta: "Próximos" },
  { valor: "al_dia", etiqueta: "Al día" },
  { valor: "sin_datos", etiqueta: "Sin periodicidad" },
];

function fecha(iso: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function VencimientosClient() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filtro, setFiltro] = useState<EstadoVencimiento | "atencion">(
    "atencion"
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/vencimientos");
    if (res.ok) {
      const d = await res.json();
      setFilas(d.clientes);
      setError(null);
    } else {
      setError(await leerErrorApi(res, "No se pudo cargar la planificación."));
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const visibles = useMemo(
    () =>
      filas.filter((f) =>
        filtro === "atencion"
          ? (f.estado === "vencido" || f.estado === "proximo") &&
            !f.yaProgramada
          : f.estado === filtro
      ),
    [filas, filtro]
  );

  const cuenta = useMemo(
    () => ({
      atencion: filas.filter(
        (f) =>
          (f.estado === "vencido" || f.estado === "proximo") && !f.yaProgramada
      ).length,
      vencido: filas.filter((f) => f.estado === "vencido").length,
      proximo: filas.filter((f) => f.estado === "proximo").length,
      al_dia: filas.filter((f) => f.estado === "al_dia").length,
      sin_datos: filas.filter((f) => f.estado === "sin_datos").length,
    }),
    [filas]
  );

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Revisiones pendientes</h1>
      <p className="mt-1 mb-5 text-sm text-suave">
        A quién le toca mantenimiento, según la periodicidad de su contrato. La
        cuenta arranca de su última visita ejecutada; si nunca ha tenido
        ninguna, de la fecha de instalación.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filtro === f.valor
                ? "bg-acento-suave font-medium text-acento-contraste"
                : "text-medio hover:bg-superficie-fuerte"
            }`}
          >
            {f.etiqueta}
            <span className="ml-1.5 text-xs opacity-70">
              {cuenta[f.valor]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-lg border border-borde bg-superficie p-6 text-sm text-suave">
          {filtro === "atencion"
            ? "No hay nada pendiente: todas las revisiones que vencen están ya programadas."
            : "No hay clientes en este estado."}
        </p>
      ) : (
        <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
          {visibles.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/clientes/${f.id}`}
                  className="truncate text-sm font-medium text-texto hover:underline"
                >
                  {f.nombre}
                </Link>
                <p className="truncate text-xs text-suave">
                  {f.periodicidadMantenimiento
                    ? `Cada ${f.periodicidadMantenimiento} meses`
                    : "Sin periodicidad"}
                  {f.isla ? ` · ${f.isla}` : ""}
                  {f.telefono ? ` · ${f.telefono}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-tenue">
                  {/* Un cliente sin ninguna visita es el caso que más fácil se
                      escapa: la cuenta arranca de su fecha de instalación y
                      conviene que se vea que nadie ha ido nunca. */}
                  {f.origen === "fecha_instalacion"
                    ? "Nunca revisado, desde la instalación"
                    : `Última revisión: ${fecha(f.ultimaVisita)}`}
                  {f.proxima ? ` · vence el ${fecha(f.proxima)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {f.yaProgramada && (
                  <span className="rounded-full bg-info-suave px-2 py-0.5 text-xs text-info-contraste">
                    Ya programada
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${ESTILO[f.estado]}`}
                  title={textoVencimiento(f)}
                >
                  {NOMBRE_VENCIMIENTO[f.estado]}
                </span>
                {!f.yaProgramada && f.estado !== "sin_datos" && (
                  <Link
                    href={`/mantenimientos/nueva?cliente=${f.id}`}
                    className="rounded border border-borde-fuerte px-2.5 py-1 text-xs hover:bg-superficie-alt"
                  >
                    Programar
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
