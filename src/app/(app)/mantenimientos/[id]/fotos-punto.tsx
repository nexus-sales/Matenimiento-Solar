"use client";

import { useRef, useState } from "react";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { leerErrorApi } from "@/lib/errores-api";

export type Foto = { id: string; pie: string | null };

/**
 * Fotos de un punto del checklist.
 *
 * El botón abre directamente la cámara en el móvil (`capture`), que es como
 * se usa esto en obra: el técnico está delante del panel, no buscando un
 * archivo en la galería.
 */
export function FotosPunto({
  mantenimientoId,
  itemId,
  fotos,
  bloqueado,
  onCambio,
}: {
  mantenimientoId: string;
  itemId: string;
  fotos: Foto[];
  bloqueado: boolean;
  onCambio: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    // Se limpia ya: si no, elegir la misma foto dos veces seguidas no
    // dispararía el evento la segunda.
    e.target.value = "";
    if (!elegidos.length) return;

    setError(null);
    setSubiendo(true);

    for (const original of elegidos) {
      try {
        const { archivo } = await comprimirImagen(original);

        const cuerpo = new FormData();
        cuerpo.append("archivo", archivo);
        cuerpo.append("itemId", itemId);

        const res = await fetch(
          `/api/mantenimientos/${mantenimientoId}/fotos`,
          { method: "POST", body: cuerpo }
        );

        if (!res.ok) {
          setError(await leerErrorApi(res, "No se pudo subir la foto."));
          break;
        }
      } catch {
        setError("No se pudo procesar la imagen.");
        break;
      }
    }

    setSubiendo(false);
    onCambio();
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
              className="h-16 w-16 rounded border border-borde object-cover"
            />
            {!bloqueado && (
              <button
                type="button"
                onClick={() => borrar(foto.id)}
                aria-label="Borrar foto"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-peligro-borde bg-peligro-suave text-xs text-peligro"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {!bloqueado && (
          <button
            type="button"
            disabled={subiendo}
            onClick={() => entrada.current?.click()}
            className="h-16 w-16 rounded border border-dashed border-borde-fuerte text-xs text-suave hover:border-acento hover:text-acento disabled:opacity-50"
          >
            {subiendo ? "…" : "+ Foto"}
          </button>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={subir}
        className="hidden"
      />

      {error && <p className="mt-1 text-xs text-peligro">{error}</p>}
    </div>
  );
}
