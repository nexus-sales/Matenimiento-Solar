"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CabeceraPagina from "../componentes/cabecera-pagina";
import {
  NOMBRE_CORTO_PLANTILLA,
  PLANTILLAS,
  type Plantilla,
} from "@/lib/plantillas";
import { leerErrorApi } from "@/lib/errores-api";

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
  fechaContacto: string | null;
  viaWhatsapp: boolean;
};

type Estado =
  | "todos"
  | "sin_avisar"
  | "pendientes"
  | "vencidos"
  | "completados";

const FILTROS: { valor: Estado; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todas" },
  { valor: "sin_avisar", etiqueta: "Sin avisar" },
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
  // El tipo de trabajo se filtra en el navegador y no en la consulta: son
  // cuatro valores sobre una lista que ya está cargada, y así cambiar de
  // pestaña es instantáneo.
  const [tipoTrabajo, setTipoTrabajo] = useState<Plantilla | "todos">("todos");
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [puedeEscribir, setPuedeEscribir] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (filtro: Estado) => {
    setCargando(true);
    const url =
      filtro === "todos"
        ? "/api/mantenimientos"
        : `/api/mantenimientos?estado=${filtro}`;
    const res = await fetch(url);
    if (res.ok) {
      const d = await res.json();
      setVisitas(d.visitas);
      setPuedeEscribir(d.puedeEscribir);
    }
    setCargando(false);
  }, []);

  /**
   * Borra una visita.
   *
   * El servidor rechaza las firmadas —un acta firmada no se borra, se anula—
   * así que el botón solo aparece en las que no lo están. Aun así se pide
   * confirmación: esto se lleva por delante las respuestas y las fotos, y no
   * hay deshacer.
   */
  async function borrar(id: string) {
    setBorrando(id);
    setError(null);

    const res = await fetch(`/api/mantenimientos/${id}`, { method: "DELETE" });

    setBorrando(null);
    setConfirmando(null);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo borrar la visita."));
      return;
    }
    cargar(estado);
  }

  useEffect(() => {
    // Carga inicial de datos al montar: sincroniza con el servidor,
    // no con estado de React — patrón habitual y correcto pese al aviso
    // de la regla react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar(estado);
  }, [cargar, estado]);

  const visibles =
    tipoTrabajo === "todos"
      ? visitas
      : visitas.filter((v) => v.plantilla === tipoTrabajo);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <CabeceraPagina
        titulo="Trabajos"
        descripcion="Preinstalaciones, instalaciones, mantenimientos y puntos de recarga."
        acciones={
          <Link
            href="/mantenimientos/nueva"
            className="rounded bg-acento px-3 py-1.5 text-sm text-acento-encima hover:bg-acento-hover"
          >
            + Programar visita
          </Link>
        }
      />

      {/* Dos ejes distintos: en qué fase está el trabajo, y en qué estado.
          Mezclarlos en una sola barra obligaba a leer ocho pestañas para
          encontrar «los puntos de recarga pendientes». */}
      <div className="mb-2 flex flex-wrap gap-1">
        {(["todos", ...PLANTILLAS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipoTrabajo(t)}
            className={
              tipoTrabajo === t
                ? "rounded-md bg-acento-suave px-3 py-1.5 text-sm font-medium text-acento-contraste"
                : "rounded-md px-3 py-1.5 text-sm text-medio hover:bg-superficie-fuerte"
            }
          >
            {t === "todos" ? "Todos los trabajos" : NOMBRE_CORTO_PLANTILLA[t]}
            <span className="ml-1.5 text-xs opacity-70">
              {t === "todos"
                ? visitas.length
                : visitas.filter((v) => v.plantilla === t).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-t border-borde pt-2">
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

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-suave">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-lg border border-borde bg-superficie p-6 text-sm text-suave">
          {estado === "sin_avisar"
            ? "No queda ninguna visita por avisar."
            : "No hay visitas que mostrar con estos filtros."}
        </p>
      ) : (
        <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
          {visibles.map((visita) => (
            /* La fila ya no es un enlace entero: dentro hay un botón, y un
               botón dentro de un enlace ni es HTML válido ni se puede pulsar
               sin navegar. El enlace queda en el nombre del cliente. */
            <div
              key={visita.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/mantenimientos/${visita.id}`}
                  className="truncate text-sm font-medium text-texto hover:underline"
                >
                  {visita.clienteNombre}
                </Link>
                <p className="truncate text-xs text-suave">
                  {visita.plantilla === "mantenimiento"
                    ? `Mantenimiento ${visita.tipo}`
                    : NOMBRE_CORTO_PLANTILLA[visita.plantilla]}
                  {visita.cups ? ` · ${visita.cups}` : ""}
                  {visita.isla ? ` · ${visita.isla}` : ""}
                  {visita.tecnicoNombre
                    ? ` · ${visita.tecnicoNombre}`
                    : " · sin técnico asignado"}
                </p>
                {/* Solo se dice algo del aviso mientras la visita esté por
                    hacer: después ya no aporta nada. */}
                {!visita.fechaEjecucion && !visita.anulada && (
                  <p className="mt-0.5 text-xs">
                    {visita.contactado ? (
                      <span className="text-suave">
                        Avisado
                        {visita.fechaContacto
                          ? ` el ${formatearFecha(visita.fechaContacto)}`
                          : ""}
                        {visita.viaWhatsapp ? " por WhatsApp" : ""}
                      </span>
                    ) : (
                      <span className="text-aviso-contraste">Sin avisar</span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
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

                {/* Borrar solo lo que no está firmado. Un acta firmada se
                    anula, no se borra, y el servidor lo rechaza igualmente. */}
                {puedeEscribir &&
                  !visita.firmado &&
                  (confirmando === visita.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="text-peligro-contraste">¿Seguro?</span>
                      <button
                        onClick={() => borrar(visita.id)}
                        disabled={borrando === visita.id}
                        className="rounded border border-peligro-borde bg-peligro-suave px-2 py-1 text-peligro-contraste disabled:opacity-50"
                      >
                        {borrando === visita.id ? "Borrando…" : "Sí, borrar"}
                      </button>
                      <button
                        onClick={() => setConfirmando(null)}
                        className="rounded border border-borde px-2 py-1 text-suave"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmando(visita.id)}
                      title="Borrar esta visita"
                      aria-label={`Borrar la visita de ${visita.clienteNombre}`}
                      className="rounded border border-borde px-2 py-1 text-xs text-suave hover:border-peligro-borde hover:text-peligro-contraste"
                    >
                      Borrar
                    </button>
                  ))}
              </div>
            </div>
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
