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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
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
