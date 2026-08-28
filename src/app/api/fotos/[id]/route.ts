import { NextRequest, NextResponse } from "next/server";
import { conSesionRLS } from "@/db";
import { respuestaFoto } from "@/db/schema";
import { eq } from "drizzle-orm";
import { obtenerSesion } from "@/lib/auth";
import { borrarFoto, leerFoto } from "@/lib/almacenamiento";

/**
 * Sirve una foto.
 *
 * No hay ninguna URL pública ni enlace firmado: la imagen se entrega solo si
 * la consulta a `respuesta_foto` devuelve la fila, y esa consulta pasa por
 * las políticas RLS. Un técnico que pida la foto de una visita ajena recibe
 * un 404 — la política le oculta la fila, y sin fila no hay archivo.
 *
 * Esa es también la razón de que la autorización no se escriba aquí: ya está
 * escrita, una sola vez, en la base de datos.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  const [fila] = await conSesionRLS(sesion, (tx) =>
    tx.select().from(respuestaFoto).where(eq(respuestaFoto.id, id)).limit(1)
  );

  if (!fila) {
    return NextResponse.json({ error: "Foto no encontrada." }, { status: 404 });
  }

  const objeto = await leerFoto(fila.url);
  if (!objeto) {
    // La fila existe pero el archivo no. Pasa si alguien lo borró por fuera
    // del sistema; no es un fallo del servidor.
    return NextResponse.json(
      { error: "La imagen ya no está en el almacenamiento." },
      { status: 404 }
    );
  }

  return new NextResponse(Buffer.from(objeto.cuerpo), {
    headers: {
      "Content-Type": objeto.tipo,
      // Privada y de un día: la imagen no cambia nunca (cada subida crea una
      // clave nueva), pero es un dato personal y no debe quedarse en caches
      // compartidas por las que pasen otras sesiones.
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  // El borrado también se apoya en RLS: si la política no deja ver la fila,
  // el DELETE no afecta a ninguna y se responde 404.
  const [borrada] = await conSesionRLS(sesion, (tx) =>
    tx.delete(respuestaFoto).where(eq(respuestaFoto.id, id)).returning()
  );

  if (!borrada) {
    return NextResponse.json({ error: "Foto no encontrada." }, { status: 404 });
  }

  // El archivo se borra después de la fila. Si esto falla queda un objeto
  // huérfano ocupando espacio, que es mucho menos grave que una fila
  // apuntando a un archivo inexistente.
  try {
    await borrarFoto(borrada.url);
  } catch {
    // Se ignora a propósito: la foto ya no es accesible desde la aplicación.
  }

  return NextResponse.json({ ok: true });
}
