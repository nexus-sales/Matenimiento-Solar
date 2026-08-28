"use client";

import { useEffect } from "react";

/**
 * Registra el service worker.
 *
 * Solo en producción: en desarrollo interceptaría las peticiones de la
 * recarga en caliente y daría problemas difíciles de relacionar con su causa.
 *
 * Lo que ese worker hace —y lo que deliberadamente no hace— está explicado
 * en public/sw.js.
 */
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Tras la carga: registrarlo antes compite por ancho de banda con lo
    // que el usuario está esperando ver.
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Que falle no rompe nada: la aplicación funciona igual sin él,
        // solo pierde la caché de estáticos y la instalación.
      });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar);

    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
