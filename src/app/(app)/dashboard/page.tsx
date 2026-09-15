"use client";

import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../componentes/cabecera-pagina";
import TarjetaKpi from "../componentes/tarjeta-kpi";

type Indicadores = {
  clientes: number;
  conMantenimiento: number;
  pendientes: number;
  vencidos: number;
  completadosEsteMes: number;
  tecnicosActivos: number;
  sinTecnicoAsignado: number;
  previstosTreintaDias: number;
};

const MES_ACTUAL = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(
  new Date()
);

export default function DashboardPage() {
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  // Revisiones que tocan segun el contrato del cliente. Es otra pregunta que
  // la de las visitas vencidas: aquella mira visitas ya programadas cuya
  // fecha paso; esta mira clientes a los que NADIE ha programado nada.
  const [revisiones, setRevisiones] = useState<{
    vencidos: number;
    proximos: number;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    // Solo oficina y administracion pueden pedir la planificacion; para un
    // tecnico responde 403 y el aviso sencillamente no aparece.
    fetch("/api/vencimientos")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRevisiones(d.resumen))
      .catch(() => {});

    const res = await fetch("/api/dashboard");
    if (res.ok) {
      setIndicadores(await res.json());
    } else {
      setError("No se pudieron cargar los indicadores.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // Carga inicial de datos al montar: sincroniza con el servidor,
    // no con estado de React — patrón habitual y correcto pese al aviso
    // de la regla react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <CabeceraPagina
        titulo="Dashboard"
        descripcion="Resumen del estado de mantenimiento de las instalaciones."
      />

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {/* El aviso va ARRIBA del todo y solo aparece si hay algo que hacer:
          una tarjeta permanente con un cero se deja de leer a la semana. */}
      {revisiones && revisiones.vencidos + revisiones.proximos > 0 && (
        <a
          href="/vencimientos"
          className="mb-8 block rounded-lg border border-aviso bg-aviso-suave p-4 hover:opacity-90"
        >
          <p className="text-sm font-semibold text-aviso-contraste">
            {revisiones.vencidos > 0
              ? `${revisiones.vencidos} cliente${revisiones.vencidos === 1 ? "" : "s"} con la revisión vencida`
              : `${revisiones.proximos} revisión${revisiones.proximos === 1 ? "" : "es"} a punto de vencer`}
          </p>
          <p className="mt-0.5 text-sm text-aviso-contraste">
            {revisiones.vencidos > 0 && revisiones.proximos > 0
              ? `Y ${revisiones.proximos} más que vencen en los próximos 30 días. `
              : ""}
            Ver quiénes son y programarles la visita →
          </p>
        </a>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium tracking-wide text-suave uppercase">
          Cartera
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaKpi
            etiqueta="Clientes"
            valor={indicadores?.clientes ?? null}
            tono="acento"
            href="/clientes"
          />
          <TarjetaKpi
            etiqueta="Con mantenimiento"
            valor={indicadores?.conMantenimiento ?? null}
            tono="acento"
            href="/clientes?mantenimiento=si"
          />
          <TarjetaKpi
            etiqueta="Técnicos activos"
            valor={indicadores?.tecnicosActivos ?? null}
            tono="info"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-wide text-suave uppercase">
          Mantenimientos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaKpi
            etiqueta="Vencidos"
            valor={indicadores?.vencidos ?? null}
            detalle="Fecha prevista pasada y sin ejecutar"
            tono="aviso"
            href="/mantenimientos?estado=vencidos"
          />
          <TarjetaKpi
            etiqueta="Pendientes"
            valor={indicadores?.pendientes ?? null}
            detalle="Sin fecha de ejecución"
            tono="info"
            href="/mantenimientos?estado=pendientes"
          />
          <TarjetaKpi
            etiqueta={`Completados en ${MES_ACTUAL}`}
            valor={indicadores?.completadosEsteMes ?? null}
            tono="acento"
            href="/mantenimientos?estado=completados"
          />
          <TarjetaKpi
            etiqueta="Previstos en 30 días"
            valor={indicadores?.previstosTreintaDias ?? null}
            detalle="Carga de trabajo del próximo mes"
            tono="neutro"
            href="/mantenimientos?estado=pendientes"
          />
          <TarjetaKpi
            etiqueta="Sin técnico asignado"
            valor={indicadores?.sinTecnicoAsignado ?? null}
            detalle="Pendientes sin responsable"
            tono="aviso"
            href="/mantenimientos?estado=pendientes"
          />
        </div>
      </section>

      {cargando && (
        <p className="mt-6 text-sm text-suave">Cargando indicadores…</p>
      )}
    </main>
  );
}
