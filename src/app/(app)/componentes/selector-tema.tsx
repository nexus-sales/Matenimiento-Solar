"use client";

import { useEffect, useState } from "react";
import {
  CONSULTA_OSCURO,
  TEMAS,
  type Tema,
  aplicarTema,
  guardarTema,
  leerTemaGuardado,
} from "@/lib/tema";

function Icono({ tema }: { tema: Tema }) {
  const comun = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (tema === "claro") {
    return (
      <svg {...comun}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (tema === "oscuro") {
    return (
      <svg {...comun}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }

  return (
    <svg {...comun}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/**
 * Selector de tema de tres estados. "Sistema" existe como opción propia y
 * es el valor por defecto: si alguien pone el portátil en oscuro por la
 * noche, la app le acompaña sin tener que acordarse de venir aquí.
 */
export default function SelectorTema() {
  // Se arranca en "sistema" y se corrige en cuanto monta: el servidor no
  // puede saber qué tema tiene guardado este navegador, y renderizar aquí
  // el valor real provocaría un desajuste de hidratación.
  const [tema, setTema] = useState<Tema>("sistema");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(leerTemaGuardado());
  }, []);

  useEffect(() => {
    if (tema !== "sistema") return;
    // Solo mientras la opción sea "sistema": si el usuario ha elegido claro
    // u oscuro a mano, su elección manda sobre lo que haga el sistema.
    const consulta = window.matchMedia(CONSULTA_OSCURO);
    const alCambiar = () => aplicarTema("sistema");
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, [tema]);

  function elegir(nuevo: Tema) {
    setTema(nuevo);
    guardarTema(nuevo);
    aplicarTema(nuevo);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className="flex rounded-md border border-borde p-0.5"
    >
      {TEMAS.map((opcion) => {
        const activo = tema === opcion.valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            title={opcion.etiqueta}
            onClick={() => elegir(opcion.valor)}
            className={
              activo
                ? "flex flex-1 items-center justify-center rounded px-2 py-1 text-acento-contraste bg-acento-suave"
                : "flex flex-1 items-center justify-center rounded px-2 py-1 text-tenue hover:text-medio"
            }
          >
            <Icono tema={opcion.valor} />
            <span className="sr-only">{opcion.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
