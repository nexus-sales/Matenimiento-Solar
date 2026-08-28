import { obtenerSesion } from "@/lib/auth";

/**
 * Ayuda dentro de la aplicación.
 *
 * Está ordenada por rol y muestra primero lo que le toca a quien la abre: el
 * técnico la consulta en el móvil, subido a una cubierta y con prisa, y no
 * puede pasar por delante media pantalla de tareas de oficina.
 *
 * Es un componente de servidor: no hay nada que el usuario pulse aquí, y así
 * no viaja JavaScript para pintar texto.
 */

function Paso({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acento-suave text-xs font-semibold text-acento-contraste">
        {n}
      </span>
      <div className="min-w-0 pb-4">
        <p className="text-sm font-medium text-texto">{titulo}</p>
        {children && (
          <div className="mt-1 text-sm text-suave">{children}</div>
        )}
      </div>
    </li>
  );
}

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-lg border border-borde bg-superficie p-5">
      <h2 className="text-base font-semibold text-texto">{titulo}</h2>
      {descripcion && (
        <p className="mt-1 mb-4 text-sm text-suave">{descripcion}</p>
      )}
      <div className={descripcion ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

function Pregunta({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-borde py-3 first:border-0 first:pt-0">
      <p className="text-sm font-medium text-texto">{q}</p>
      <div className="mt-1 text-sm text-suave">{children}</div>
    </div>
  );
}

function BloqueTecnico() {
  return (
    <Seccion
      titulo="Hacer una visita"
      descripcion="Lo que haces en casa del cliente, de principio a fin."
    >
      <ol>
        <Paso n={1} titulo="Abre la visita desde Mantenimientos">
          Solo aparecen las visitas que tienes asignadas. Arriba verás la
          dirección, el CUPS y si la instalación tiene batería.
        </Paso>
        <Paso n={2} titulo="Marca cada punto: Correcto, Incidencia o No aplica">
          <p>
            <strong>No aplica</strong> es para lo que esa instalación no tiene
            —por ejemplo los cimientos si la estructura no lleva, o el bloque de
            baterías si no hay—. No es lo mismo que dejarlo sin marcar.
          </p>
          <p className="mt-1">
            Se guarda solo, punto a punto, según avanzas. No hay que pulsar
            nada al final.
          </p>
        </Paso>
        <Paso n={3} titulo="Si marcas Incidencia, explica qué has encontrado">
          Se abre un cuadro de texto. Sin esa explicación no se puede cerrar la
          visita: es lo que la oficina necesita para saber a qué volver.
        </Paso>
        <Paso n={4} titulo="Haz fotos donde haga falta">
          <p>
            Con <strong>Cámara</strong> disparas en el momento; con{" "}
            <strong>Galería</strong> subes varias que ya tuvieras hechas.
          </p>
          <p className="mt-1">
            Se reducen en el propio móvil antes de subirlas, así que gastan
            poca conexión aunque haya poca cobertura.
          </p>
        </Paso>
        <Paso n={5} titulo="Usa la observación del bloque para lo general">
          Al final de cada bloque hay un cuadro para lo que afecta al conjunto
          —«toda la estructura con óxido en la cara sur»— en vez de repetirlo
          punto por punto.
        </Paso>
        <Paso n={6} titulo="Firmad tú y el cliente, y cierra">
          <p>
            Los nombres y documentos vienen puestos. Cámbialos si firma otra
            persona, por ejemplo un familiar.
          </p>
          <p className="mt-1">
            <strong>Al cerrar, la visita ya no se puede modificar.</strong>{" "}
            Revisa antes de firmar.
          </p>
        </Paso>
      </ol>
    </Seccion>
  );
}

function BloqueOficina() {
  return (
    <>
      <Seccion
        titulo="Dar de alta un cliente"
        descripcion="La ficha del cliente es el centro: los demás módulos leen de ella y no vuelven a pedir estos datos."
      >
        <ol>
          <Paso n={1} titulo="Clientes → + Nuevo cliente" />
          <Paso n={2} titulo="Rellena identificación y contacto">
            La provincia se pone sola al elegir la isla. Si el código postal no
            corresponde a esa isla, te avisa: casi siempre es un error de
            tecleo.
          </Paso>
          <Paso n={3} titulo="Añade los datos de la instalación">
            CUPS, potencias, inversor y comercializadora. El técnico los verá en
            la visita sin tener que preguntarlos, y salen en el acta.
          </Paso>
          <Paso n={4} titulo="Marca Mantenimiento: Sí si tiene contrato">
            Es lo que decide si el cliente entra en la planificación. Sin esto
            no se le pueden programar visitas.
          </Paso>
        </ol>
      </Seccion>

      <Seccion
        titulo="Programar y asignar una visita"
        descripcion="Programar es trabajo de oficina: el técnico ejecuta lo que tiene asignado, no se asigna a sí mismo."
      >
        <ol>
          <Paso n={1} titulo="Mantenimientos → + Programar visita" />
          <Paso n={2} titulo="Elige semestral o anual">
            La semestral muestra al técnico solo los puntos de esa periodicidad;
            la anual, el checklist completo.
          </Paso>
          <Paso n={3} titulo="Asigna técnico">
            <p>
              Salen primero los de la isla del cliente, y detrás el resto bajo
              «Con desplazamiento» — en las islas menores no hay técnico fijo.
            </p>
            <p className="mt-1">
              <strong>Una visita sin asignar no la ve ningún técnico.</strong>{" "}
              Se puede asignar o cambiar después desde la propia visita.
            </p>
          </Paso>
        </ol>
      </Seccion>

      <Seccion
        titulo="Cerrar el círculo: acta y factura"
        descripcion="Cuando el técnico firma, la visita aparece cerrada al instante."
      >
        <ol>
          <Paso n={1} titulo="Pon el nº de factura cuando factures">
            Se puede rellenar aunque la visita ya esté firmada: no forma parte
            de lo que firmó el cliente. Aparece en el acta.
          </Paso>
          <Paso n={2} titulo="Descarga el acta en PDF">
            Desde la visita o desde el histórico del cliente. Lleva los datos,
            el recorrido punto por punto con las fotos, las incidencias
            resumidas al principio y las dos firmas.
          </Paso>
          <Paso n={3} titulo="Envíasela al cliente con la factura">
            La aplicación no manda correos: el acta se descarga y la envías tú
            con la factura.
          </Paso>
        </ol>
      </Seccion>
    </>
  );
}

export default async function AyudaPage() {
  const sesion = await obtenerSesion();
  const esTecnico = sesion?.rol === "tecnico";

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Ayuda</h1>
      <p className="mt-1 mb-6 text-sm text-suave">
        Cómo se usa la aplicación, paso a paso.
      </p>

      {/* Al técnico le sale primero lo suyo: la consulta en el móvil, en
          casa del cliente, y no debe tener que desplazarse por lo demás. */}
      {esTecnico ? (
        <>
          <BloqueTecnico />
          <details className="mb-8">
            <summary className="cursor-pointer text-sm text-suave">
              Ver también lo que hace la oficina
            </summary>
            <div className="mt-4">
              <BloqueOficina />
            </div>
          </details>
        </>
      ) : (
        <>
          <BloqueOficina />
          <BloqueTecnico />
        </>
      )}

      <Seccion titulo="Dudas frecuentes">
        <Pregunta q="No me deja firmar la visita">
          Falta algún punto por marcar, o hay una incidencia sin explicar. El
          aviso encima del botón dice cuál de las dos cosas es.
        </Pregunta>
        <Pregunta q="He firmado por error">
          Avisa a administración. Una visita firmada no se puede reabrir ni
          corregir —es lo que hace que el acta valga—, pero se puede{" "}
          <strong>anular</strong> dejando escrito el motivo, y se programa otra
          para el mismo cliente. El acta anulada se conserva con un sello, para
          que no quede un hueco sin explicación en el histórico.
        </Pregunta>
        <Pregunta q="No veo una visita que sé que existe">
          Cada técnico ve solo las visitas que tiene asignadas. Si no aparece,
          probablemente no está asignada a ti o está sin asignar.
        </Pregunta>
        <Pregunta q="La foto no sube">
          Si no hay cobertura la aplicación te lo dice y la foto sigue en el
          móvil. Vuelve a intentarlo cuando tengas señal.
        </Pregunta>
        <Pregunta q="He olvidado mi contraseña">
          No hay recuperación por correo: pídesela a administración, que puede
          asignarte una nueva.
        </Pregunta>
        <Pregunta q="¿Puedo instalar la aplicación en el móvil?">
          Sí. Desde el navegador, en el menú, elige «Añadir a pantalla de
          inicio». Se abre sin la barra del navegador y se ve más.
        </Pregunta>
      </Seccion>

      <Seccion
        titulo="Quién puede hacer qué"
        descripcion="Las reglas no son solo de pantalla: la base de datos las aplica por su cuenta."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                <th className="pb-2 pr-4 font-medium">Rol</th>
                <th className="pb-2 font-medium">Puede</th>
              </tr>
            </thead>
            <tbody className="text-suave">
              <tr className="border-b border-borde">
                <td className="py-2 pr-4 font-medium text-texto">Técnico</td>
                <td className="py-2">
                  Ver y rellenar <strong>solo sus visitas</strong>. Consultar
                  clientes. No programa ni se asigna trabajo.
                </td>
              </tr>
              <tr className="border-b border-borde">
                <td className="py-2 pr-4 font-medium text-texto">Oficina</td>
                <td className="py-2">
                  Todo lo de clientes y visitas: alta, programación, asignación
                  y facturación.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-texto">
                  Administración
                </td>
                <td className="py-2">
                  Lo anterior, más gestionar usuarios y el catálogo del
                  checklist.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Seccion>
    </main>
  );
}
