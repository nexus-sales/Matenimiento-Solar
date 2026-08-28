import { NextResponse } from "next/server";

/**
 * Traduce la violación de unicidad de Postgres (23505) a un mensaje que
 * diga QUÉ está repetido: en la ficha de cliente, documento y CUPS son
 * ambos únicos, y un "ya existe" a secas obliga al usuario a adivinar
 * cuál de los dos tiene que revisar.
 */
export function errorDeDuplicado(err: unknown) {
  if (
    !(err instanceof Error) ||
    !("code" in err) ||
    (err as { code?: string }).code !== "23505"
  ) {
    return null;
  }

  const detalle = String((err as { detail?: string }).detail ?? "").toLowerCase();
  return NextResponse.json(
    {
      error: detalle.includes("cups")
        ? "Ya existe un cliente con ese CUPS."
        : "Ya existe un cliente con ese documento.",
    },
    { status: 409 }
  );
}
