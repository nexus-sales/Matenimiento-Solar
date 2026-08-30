"use client";

import { useRef, useState } from "react";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { leerErrorApi } from "@/lib/errores-api";

export type Foto = { id: string; pie: string | null };

/**
 * Fotos de un punto del checklist.
 *
 * La camara y la galeria usan inputs separados. `capture` con `multiple`
 * falla en varios navegadores moviles: la camara se abre, se hace la foto y
 * el evento `change` no siempre llega. Separarlo permite pedir camara de
 * forma explicita sin perder la subida multiple desde galeria.
 */
export function FotosPunto({
  intervencionId,
  itemId,
  fotos,
  bloqueado,
  onCambio,
}: {
  intervencionId: string;
  itemId: string;
  fotos: Foto[];
  bloqueado: boolean;
  onCambio: () => void;
}) {
  const entradaCamara = useRef<HTMLInputElement>(null);
  const entradaGaleria = useRef<HTMLInputElement>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const entradaDom = e.target;
    const elegidos = Array.from(entradaDom.files ?? []);

    if (!elegidos.length) {
      setError("El dispositivo no devolvió ninguna imagen. Inténtalo otra vez.");
      return;
    }

    setError(null);
    let subidas = 0;

    for (const [i, original] of elegidos.entries()) {
      setProgreso(
        elegidos.length > 1
          ? `Subiendo ${i + 1} de ${elegidos.length}…`
          : "Subiendo…"
      );

      // comprimirImagen nunca lanza: si no puede, devuelve el original.
      const { archivo, nota } = await comprimirImagen(original);

      const cuerpo = new FormData();
      cuerpo.append("archivo", archivo);
      cuerpo.append("itemId", itemId);

      try {
        const res = await fetch(
          `/api/mantenimientos/${intervencionId}/fotos`,
          { method: "POST", body: cuerpo }
        );

        if (!res.ok) {
          setError(await leerErrorApi(res, "No se pudo subir la foto."));
          break;
        }
        subidas++;
      } catch {
        // Aquí solo se llega si la petición no sale: sin cobertura, o el
        // servidor no responde. Es el caso típico en una cubierta.
        setError(
          "No se pudo enviar la foto: sin conexión con el servidor. " +
            (nota ? `(${nota}) ` : "") +
            "La foto sigue en tu galería; vuelve a intentarlo con cobertura."
        );
        break;
      }
    }

    setProgreso(null);
    // Se limpia al final, no al principio: en algunos navegadores móviles
    // vaciar el input antes de leer los archivos invalida las referencias.
    entradaDom.value = "";

    if (subidas > 0) onCambio();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta foto?")) return;
    const res = await fetch(`/api/fotos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo borrar la foto."));
      return;
    }
    onCambio();
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {fotos.map((foto) => (
          <div key={foto.id} className="relative">
            {/* Imagen servida por la app tras comprobar la sesión y las
                políticas RLS: no hay URL que funcione sin permiso. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/fotos/${foto.id}`}
              alt={foto.pie ?? "Foto del punto"}
              className="h-20 w-20 rounded border border-borde object-cover"
            />
            {!bloqueado && (
              <button
                type="button"
                onClick={() => borrar(foto.id)}
                aria-label="Borrar foto"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-peligro-borde bg-superficie text-sm text-peligro"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {!bloqueado && (
          <>
            <button
              type="button"
              disabled={progreso !== null}
              onClick={() => entradaCamara.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-borde-fuerte text-xs text-suave hover:border-acento hover:text-acento disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-6 w-6"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Camara
            </button>

            <button
              type="button"
              disabled={progreso !== null}
              onClick={() => entradaGaleria.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-borde-fuerte text-xs text-suave hover:border-acento hover:text-acento disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-6 w-6"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Galeria
            </button>
          </>
        )}
      </div>

      <input
        ref={entradaCamara}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={subir}
        className="hidden"
      />

      <input
        ref={entradaGaleria}
        type="file"
        accept="image/*"
        multiple
        onChange={subir}
        className="hidden"
      />

      {progreso && <p className="mt-2 text-xs text-suave">{progreso}</p>}

      {/* El error va destacado, no como nota al pie: esto se lee en una
          cubierta, a contraluz y con prisa. */}
      {error && (
        <p className="mt-2 rounded-md border border-peligro-borde bg-peligro-suave p-2 text-xs text-peligro-contraste">
          {error}
        </p>
      )}
    </div>
  );
}
