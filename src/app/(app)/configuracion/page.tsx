import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { datosLegalesPendientes } from "@/lib/legal";

/**
 * Índice de configuración.
 *
 * Reúne lo que solo toca administración y que antes estaba suelto o no
 * existía: los usuarios, los permisos que no caben en un rol, y el catálogo
 * de los tres formularios.
 *
 * La guarda es de servidor y redirige, no oculta: esconder el enlace del menú
 * no impide escribir la dirección a mano.
 */

const SECCIONES = [
  {
    href: "/usuarios",
    titulo: "Usuarios",
    descripcion:
      "Altas, bajas y roles. Una baja desactiva, no borra: se conserva qué " +
      "técnico hizo cada visita.",
  },
  {
    href: "/configuracion/acceso",
    titulo: "Acceso a los clientes",
    descripcion:
      "Un técnico ve solo los clientes de sus visitas. Aquí se hace la " +
      "excepción, técnico por técnico.",
  },
  {
    href: "/legal/privacidad",
    titulo: "Textos legales",
    descripcion:
      "Privacidad, cookies y aviso legal. Se generan con los datos de la " +
      "empresa; si falta alguno, se avisa aquí abajo.",
  },
  {
    href: "/configuracion/formularios",
    titulo: "Formularios",
    descripcion:
      "Los campos de las tres plantillas. Se pueden desactivar los que no " +
      "apliquen a vuestra forma de trabajar.",
  },
];

export default async function ConfiguracionPage() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") {
    redirect("/");
  }

  const pendientes = datosLegalesPendientes();

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <p className="mt-1 mb-6 text-sm text-suave">
        Lo que solo puede tocar administración.
      </p>

      {/* Los textos legales se construyen con los datos de la empresa. Los que
          falten salen marcados en la página pública, así que conviene que
          administración se entere aquí y no cuando lo vea un cliente. */}
      {pendientes.length > 0 && (
        <div className="mb-6 rounded-lg border border-aviso bg-aviso-suave p-4 text-sm text-aviso-contraste">
          <p className="font-semibold">
            Faltan datos en los textos legales
          </p>
          <ul className="mt-1 list-disc pl-5">
            {pendientes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Aparecen marcados como pendientes en las páginas públicas de
            privacidad y aviso legal, y en el pie de cada acta. Se rellenan con
            las variables <code>LEGAL_*</code> en el panel de despliegue.
          </p>
        </div>
      )}

      <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-start justify-between gap-4 p-4 hover:bg-superficie-alt"
          >
            <div>
              <p className="text-sm font-medium text-texto">{s.titulo}</p>
              <p className="mt-0.5 text-sm text-suave">{s.descripcion}</p>
            </div>
            <span aria-hidden className="mt-0.5 shrink-0 text-tenue">
              →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
