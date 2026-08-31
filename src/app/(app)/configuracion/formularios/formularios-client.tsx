"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";
import {
  bloquesDe,
  NOMBRE_PLANTILLA,
  PLANTILLAS,
  type Plantilla,
} from "@/lib/plantillas";

type Campo = {
  id: string;
  plantilla: Plantilla;
  categoria: string;
  nombre: string;
  tipo: "estado" | "foto" | "texto" | "numero" | "medida" | "si_no" | "lista";
  obligatorio: boolean;
  unidad: string | null;
  ayuda: string | null;
  periodicidadMeses: number | null;
  orden: number;
  activo: boolean;
  /** Cuántas visitas han respondido ya a este campo. */
  respuestas: number;
};

const NOMBRE_TIPO: Record<Campo["tipo"], string> = {
  estado: "Estado",
  foto: "Foto",
  texto: "Texto",
  numero: "Número",
  medida: "Medida",
  si_no: "Sí / No",
  lista: "Lista",
};

export default function FormulariosClient() {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [plantilla, setPlantilla] = useState<Plantilla>("acta_obra");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/plantillas");
    if (res.ok) {
      setCampos(await res.json());
      setError(null);
    } else {
      setError(await leerErrorApi(res, "No se pudo cargar el catálogo."));
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const suyos = useMemo(
    () => campos.filter((c) => c.plantilla === plantilla),
    [campos, plantilla]
  );

  const bloques = useMemo(
    () =>
      bloquesDe(
        plantilla,
        suyos.map((c) => c.categoria)
      ),
    [plantilla, suyos]
  );

  const activos = suyos.filter((c) => c.activo).length;

  async function cambiar(campo: Campo, activo: boolean) {
    setGuardando(true);
    setError(null);
    setAviso(null);

    // Optimista: el interruptor responde en el acto y se corrige si el
    // servidor rechaza el cambio.
    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, activo } : c))
    );

    const res = await fetch("/api/plantillas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantilla, cambios: [{ id: campo.id, activo }] }),
    });

    setGuardando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar el cambio."));
      cargar();
      return;
    }

    if (!activo && campo.respuestas > 0) {
      setAviso(
        `«${campo.nombre}» ya está respondido en ${campo.respuestas} ` +
          `visita${campo.respuestas === 1 ? "" : "s"}. Esas respuestas se ` +
          "conservan y siguen saliendo en sus actas: solo deja de pedirse en " +
          "las visitas nuevas."
      );
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <Link href="/configuracion" className="text-sm text-suave">
        ← Configuración
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Formularios</h1>
      <p className="mt-1 text-sm text-suave">
        Los campos de cada plantilla. Desactiva los que no apliquen a vuestra
        forma de trabajar — los doce huecos de número de serie sobran en una
        instalación de seis paneles.
      </p>

      <div className="mt-4 rounded-lg border border-borde bg-superficie-alt p-4 text-sm text-suave">
        <strong className="text-texto">Desactivar no borra nada.</strong> Lo que
        ya se respondió se conserva y sigue apareciendo en las actas firmadas;
        el campo solo deja de pedirse en las visitas nuevas. Es la diferencia
        entre corregir el formulario y reescribir el pasado.
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {PLANTILLAS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPlantilla(p);
              setAviso(null);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              plantilla === p
                ? "border-acento bg-acento-suave text-acento-contraste"
                : "border-borde text-suave hover:border-borde-fuerte"
            }`}
          >
            {NOMBRE_PLANTILLA[p]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {aviso && (
        <p className="mt-4 rounded-md border border-aviso bg-aviso-suave p-3 text-sm text-aviso-contraste">
          {aviso}
        </p>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-suave">Cargando…</p>
      ) : (
        <>
          <p className="mt-5 mb-2 text-sm text-suave">
            {activos} de {suyos.length} campos activos
          </p>

          {bloques.map((bloque) => {
            const delBloque = suyos.filter((c) => c.categoria === bloque.clave);
            const activosBloque = delBloque.filter((c) => c.activo).length;

            return (
              <section key={bloque.clave} className="mb-5">
                <h2 className="mb-2 flex flex-wrap items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-tenue">
                  {bloque.nombre}
                  <span className="font-normal normal-case tracking-normal">
                    {activosBloque} de {delBloque.length}
                  </span>
                </h2>

                <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
                  {delBloque.map((campo) => (
                    <label
                      key={campo.id}
                      className="flex cursor-pointer items-start gap-3 p-3 hover:bg-superficie-alt"
                    >
                      <input
                        type="checkbox"
                        checked={campo.activo}
                        disabled={guardando}
                        onChange={(e) => cambiar(campo, e.target.checked)}
                        className="mt-0.5 accent-acento"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm ${
                            campo.activo ? "text-texto" : "text-tenue line-through"
                          }`}
                        >
                          {campo.nombre}
                          {campo.obligatorio && (
                            <span
                              className="ml-1 text-peligro-contraste"
                              title="Obligatorio para poder firmar"
                            >
                              *
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-tenue">
                          <span>{NOMBRE_TIPO[campo.tipo]}</span>
                          {campo.unidad && <span>· {campo.unidad}</span>}
                          {campo.periodicidadMeses !== null && (
                            <span>· cada {campo.periodicidadMeses} meses</span>
                          )}
                          {campo.respuestas > 0 && (
                            <span>
                              · respondido en {campo.respuestas} visita
                              {campo.respuestas === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
