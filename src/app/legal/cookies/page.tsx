import type { Metadata } from "next";
import { ALMACENAMIENTO_NAVEGADOR, RESPONSABLE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de cookies — SR Energía",
  description:
    "Qué guarda esta aplicación en tu navegador: una cookie de sesión y dos " +
    "preferencias de interfaz. Sin analítica ni terceros.",
};

export default function CookiesPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Política de cookies</h1>
      <p className="text-suave">
        Qué guarda esta aplicación en tu navegador, para qué, y por qué no verás
        aquí una ventana pidiéndote permiso.
      </p>

      <div className="my-6 rounded-lg border border-borde bg-superficie p-4">
        <p className="mb-2 text-sm font-semibold text-texto">En una línea</p>
        <p className="mb-0 text-sm text-suave">
          Una cookie para mantener la sesión iniciada y dos preferencias de
          interfaz. <strong>Ni analítica, ni publicidad, ni seguimiento, ni un
          solo recurso de un tercero</strong> — ni siquiera las tipografías se
          cargan de fuera.
        </p>
      </div>

      <h2>Por qué no hay ventana de consentimiento</h2>
      <p>
        Porque la ley no la exige aquí. El artículo 22.2 de la LSSI-CE, que
        traspone la Directiva 2002/58/CE, exime del consentimiento a las cookies{" "}
        <strong>estrictamente necesarias</strong> para prestar un servicio que
        el usuario ha solicitado expresamente. La Agencia Española de Protección
        de Datos incluye en esa exención tanto las de autenticación o
        identificación de sesión como las de personalización de la interfaz.
      </p>
      <p>
        Las tres cosas que guarda esta aplicación entran en esa categoría: sin
        la cookie de sesión habría que teclear la contraseña en cada pantalla, y
        las otras dos solo se escriben cuando eres tú quien elige el tema o
        pliega el menú.
      </p>
      <p>
        Pedirte permiso para algo que ya has solicitado no aportaría nada:
        sería un clic obligatorio sin ninguna elección real detrás.{" "}
        <strong>Informar sí es obligatorio</strong>, y es lo que hace esta
        página.
      </p>

      <h2>Qué se guarda exactamente</h2>

      <div className="my-4 space-y-3">
        {ALMACENAMIENTO_NAVEGADOR.map((a) => (
          <div
            key={a.nombre}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
              <code className="font-mono text-sm font-semibold text-texto">
                {a.nombre}
              </code>
              <span className="text-xs text-tenue">{a.tipo}</span>
              {a.exenta && (
                <span className="rounded-full bg-acento-suave px-2 py-0.5 text-xs text-acento-contraste">
                  Exenta de consentimiento
                </span>
              )}
            </div>
            <p className="mb-1 text-sm">{a.finalidad}</p>
            <p className="mb-1 text-sm text-suave">{a.detalle}</p>
            <p className="mb-0 text-xs text-tenue">Duración: {a.duracion}</p>
          </div>
        ))}
      </div>

      <p>
        Las dos últimas no son técnicamente cookies, sino{" "}
        <em>almacenamiento local</em>: no viajan al servidor en cada petición y
        no salen de tu dispositivo. Se listan aquí porque la normativa trata
        igual cualquier almacenamiento en el equipo del usuario, se llame como
        se llame.
      </p>

      <h2>Lo que esta aplicación no hace</h2>
      <ul>
        <li>No usa herramientas de analítica ni de medición de audiencia.</li>
        <li>No hay cookies de publicidad ni de redes sociales.</li>
        <li>
          No carga ningún recurso desde servidores de terceros: ni tipografías,
          ni iconos, ni bibliotecas externas. Todo se sirve desde el propio
          dominio, así que ningún tercero ve tu dirección IP al usarla.
        </li>
        <li>
          La aplicación puede instalarse en el móvil y guarda en el navegador
          los archivos de diseño y programación para funcionar más rápido. En
          esa memoria <strong>no se guarda ningún dato personal</strong>: ni
          fichas de clientes, ni fotografías, ni respuestas de las visitas.
        </li>
      </ul>

      <h2>Cómo borrarlas</h2>
      <p>
        Desde la configuración de tu navegador puedes eliminar los datos de este
        sitio en cualquier momento. Si borras la cookie de sesión, simplemente
        tendrás que volver a iniciar sesión; si borras las preferencias, la
        aplicación volverá a su aspecto por defecto.
      </p>
      <p>
        Cerrar sesión desde la propia aplicación elimina la cookie de sesión de
        inmediato.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier duda sobre esta política puedes escribir a{" "}
        {RESPONSABLE.email ?? "el contacto indicado en la política de privacidad"}.
      </p>
    </>
  );
}
