"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Captura de firma manuscrita. Funciona con dedo, lápiz táctil y ratón
 * a través de Pointer Events, que unifican los tres.
 *
 * El lienzo se dibuja al tamaño real de pantalla (multiplicado por
 * devicePixelRatio) porque si no, en un móvil el trazo sale pixelado: el
 * CSS lo escalaría desde una imagen de menos resolución.
 */
export function Firma({
  valor,
  onChange,
  etiqueta,
}: {
  valor: string | null;
  onChange: (dataUrl: string | null) => void;
  etiqueta: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(!valor);

  useEffect(() => {
    const lienzo = ref.current;
    if (!lienzo) return;

    const escala = window.devicePixelRatio || 1;
    const caja = lienzo.getBoundingClientRect();
    lienzo.width = caja.width * escala;
    lienzo.height = caja.height * escala;

    const ctx = lienzo.getContext("2d");
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // El trazo se lee sobre el fondo blanco del lienzo, que es el que se
    // incrusta en el informe — no depende del tema de la app.
    ctx.strokeStyle = "#111111";
  }, []);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    dibujando.current = true;
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const lienzo = ref.current;
    if (!lienzo) return;
    setVacio(false);
    onChange(lienzo.toDataURL("image/png"));
  }

  function borrar() {
    const lienzo = ref.current;
    const ctx = lienzo?.getContext("2d");
    if (!lienzo || !ctx) return;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    setVacio(true);
    onChange(null);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-suave">{etiqueta}</span>
        {!vacio && (
          <button
            type="button"
            onClick={borrar}
            className="text-xs text-suave underline-offset-2 hover:text-peligro hover:underline"
          >
            Borrar
          </button>
        )}
      </div>
      <canvas
        ref={ref}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        // touch-none evita que el gesto de firmar haga scroll en el móvil.
        className="h-32 w-full touch-none rounded border border-borde-fuerte bg-white"
      />
      {vacio && (
        <p className="mt-1 text-xs text-tenue">Firma aquí con el dedo</p>
      )}
    </div>
  );
}
