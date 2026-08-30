"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CabeceraPagina from "../componentes/cabecera-pagina";
import { NOMBRE_PLANTILLA, type Plantilla } from "@/lib/plantillas";

type Visita = {
  id: string;
  fechaPrevista: string;
  fechaEjecucion: string | null;
  contactado: boolean;
  firmado: boolean;
  anulada: boolean;
  cups: string;
  isla: string | null;
  clienteId: string;
  clienteNombre: string;
  tecnicoNombre: string | null;
  plantilla: Plantilla;
  tipo: "semestral" | "anual";
};

type Estado = "todos" | "pendientes" | "vencidos" | "completados";

const FILTROS: { valor: Estado; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todas" },
  { valor: "vencidos", etiqueta: "Vencidas" },
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "completados", etiqueta: "Completadas" },
];

function formatearFecha(fecha: string | null) {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function estaVencida(visita: Visita) {
  if (visita.fechaEjecucion) return false;
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return visita.fechaPrevista < `${hoy.getFullYear()}-${mes}-${dia}`;
}

function ListadoMantenimientos() {
  const parametros = useSearchParams();
  const estadoInicial = (parametros.get("estado") as Estado) ?? "todos";

  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (filtro: Estado) => {
    setCargando(true);
    const url =
      filtro === "todos"
        ? "/api/mantenimientos"
        : `/api/mantenimientos?estado=${filtro}`;
    const res = await fetch(url);
    if (res.ok) setVisitas(await res.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    // Carga inicial de datos al montar: sincroniza con el servidor,
    // no con estado de React — patrón habitual y correcto pese al aviso
    // de la regla react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar(estado);
  }, [cargar, estado]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <CabeceraPagina
        titulo="Mantenimientos"
        descripcion="Visitas programadas y ejecutadas."
        acciones={
          <Link
            href="/mantenimientos/nueva"
            className="rounded bg-acento px-3 py-1.5 text-sm text-acento-encima hover:bg-acento-hover"
          >
            + Programar visita
          </Link>
        }
      />

      <div className="mb-4 flex gap-1">
        {FILTROS.map((filtro) => (
          <button
            key={filtro.valor}
            onClick={() => setEstado(filtro.valor)}
            className={
              estado === filtro.valor
                ? "rounded-md bg-acento-suave px-3 py-1.5 text-sm font-medium text-acento-contraste"
                : "rounded-md px-3 py-1.5 text-sm text-medio hover:bg-superficie-fuerte"
            }
          >
            {filtro.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : visitas.length === 0 ? (
        <p className="rounded-lg border border-borde bg-superficie p-6 text-sm text-suave">
          No hay visitas que mostrar con este filtro.
        </p>
      ) : (
        <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
          {visitas.map((visita) => (
            <Link
              key={visita.id}
              href={`/mantenimientos/${visita.id}`}
              className="flex items-center justify-between gap-4 p-3 hover:bg-superficie-alt"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-texto">
                  {visita.clienteNombre}
                </p>
                <p className="truncate text-xs text-suave">
                  {/* En una obra, "semestral" o "anual" no significan nada:
                      lo que distingue la fila es de qué formulario es. */}
                  {visita.plantilla === "mantenimiento"
                    ? visita.tipo === "semestral"
                      ? "Semestral"
                      : "Anual"
                    : NOMBRE_PLANTILLA[visita.plantilla]}
                  {visita.cups ? ` · ${visita.cups}` : ""}
                  {visita.isla ? ` · ${visita.isla}` : ""}
                  {visita.tecnicoNombre
                    ? ` · ${visita.tecnicoNombre}`
                    : " · sin técnico asignado"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {visita.anulada ? (
                  <span className="rounded-full bg-peligro-suave px-2 py-0.5 text-xs text-peligro-contraste">
                    Anulada
                  </span>
                ) : visita.fechaEjecucion ? (
                  <span className="rounded-full bg-acento-suave px-2 py-0.5 text-xs text-acento-contraste">
                    Ejecutada {formatearFecha(visita.fechaEjecucion)}
                  </span>
                ) : estaVencida(visita) ? (
                  <span className="rounded-full bg-aviso-suave px-2 py-0.5 text-xs text-aviso-contraste">
                    Vencida {formatearFecha(visita.fechaPrevista)}
                  </span>
                ) : (
                  <span className="rounded-full bg-info-suave px-2 py-0.5 text-xs text-info-contraste">
                    Prevista {formatearFecha(visita.fechaPrevista)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default function MantenimientosPage() {
  // useSearchParams obliga a envolver el listado en Suspense.
  return (
    <Suspense
      fallback={<p className="p-8 text-sm text-suave">Cargando…</p>}
    >
      <ListadoMantenimientos />
    </Suspense>
  );
}
