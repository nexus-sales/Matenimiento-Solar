"use client";

import { ISLAS_CANARIAS } from "@/lib/islas";

/**
 * Desplegable único para el campo isla. La opción vacía es "sin dato"
 * (el servidor la guarda como null), no una isla más.
 */
export function SelectIsla({
  value,
  onChange,
  id,
  required = false,
}: {
  value: string;
  onChange: (isla: string) => void;
  id?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
    >
      <option value="">— Selecciona isla —</option>
      {ISLAS_CANARIAS.map((isla) => (
        <option key={isla} value={isla}>
          {isla}
        </option>
      ))}
    </select>
  );
}
