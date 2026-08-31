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

        <p className="mt-4 border-t border-borde pt-4 text-sm text-suave">
          <strong className="text-texto">¿Tienes la cartera en un Excel?</strong>{" "}
          Clientes → Importar. Se lee el archivo y se enseña fila por fila qué
          va a pasar <em>antes</em> de escribir nada: cuáles son nuevos, cuáles
          ya están y cuáles tienen algún dato mal. Solo entonces se confirma.
        </p>
      </Seccion>

      <Seccion
        titulo="Programar y asignar una visita"
        descripcion="Programar es trabajo de oficina: el técnico ejecuta lo que tiene asignado, no se asigna a sí mismo."
      >
        <ol>
          <Paso n={1} titulo="Mantenimientos → + Programar visita" />
          <Paso n={2} titulo="Elige el formulario">
            Visita previa, acta de obra o mantenimiento. Es lo primero que se
            elige porque decide todo lo demás, incluidos a qué clientes se
            puede programar.
          </Paso>
          <Paso n={3} titulo="Solo en mantenimiento: semestral o anual">
            La semestral muestra al técnico solo los puntos de esa periodicidad;
            la anual, el checklist completo. En una obra no aparece: no hay
            periodicidad que filtrar.
          </Paso>
          <Paso n={4} titulo="Avisa al cliente y déjalo apuntado">
            <p>
              En la visita, «Aviso al cliente» → <strong>Marcar como
              avisado</strong>. Guarda la fecha y, si fue por WhatsApp, se
              marca la casilla.
            </p>
            <p className="mt-1">
              El filtro <strong>Sin avisar</strong> de la lista es la cola de
              trabajo: todas las que están programadas y a las que todavía no
              ha llamado nadie. Sin esto se llama dos veces al mismo cliente, o
              a ninguno, y el técnico se planta donde no le esperan — a veces
              después de coger un barco.
            </p>
          </Paso>
          <Paso n={5} titulo="Asigna técnico">
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

      <Seccion
        titulo="Los tres formularios"
        descripcion="La aplicación cubre el ciclo entero de una instalación, no solo el mantenimiento. Se elige el formulario al programar la visita."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                <th className="pb-2 pr-4 font-medium">Formulario</th>
                <th className="pb-2 pr-4 font-medium">Cuándo</th>
                <th className="pb-2 font-medium">Qué se rellena</th>
              </tr>
            </thead>
            <tbody className="text-suave">
              <tr className="border-b border-borde">
                <td className="py-2 pr-4 font-medium text-texto">
                  Visita previa
                </td>
                <td className="py-2 pr-4">Antes de instalar</td>
                <td className="py-2">
                  51 campos: cubierta, sombras, acceso, canalizaciones,
                  secciones de cable y fotos de los exteriores para los planos
                  del ayuntamiento.
                </td>
              </tr>
              <tr className="border-b border-borde">
                <td className="py-2 pr-4 font-medium text-texto">
                  Acta de obra
                </td>
                <td className="py-2 pr-4">Al terminar la instalación</td>
                <td className="py-2">
                  56 campos, y 48 son fotos: es sobre todo un protocolo
                  fotográfico de la obra ejecutada, con los números de serie de
                  los paneles y del inversor.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-texto">
                  Mantenimiento
                </td>
                <td className="py-2 pr-4">Cada 6 o 12 meses</td>
                <td className="py-2">
                  Los 24 puntos del contrato, cada uno correcto, con incidencia
                  o no aplica.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-suave">
          Los tres funcionan igual: se rellenan en el móvil, se firman por
          técnico y cliente, y producen un PDF con las dos firmas.{" "}
          <strong>El mantenimiento solo se programa a clientes que lo tienen
          contratado</strong>; una obra, a cualquier cliente dado de alta —
          quien va a instalar todavía no tiene nada que mantener.
        </p>
      </Seccion>

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

      <Seccion
        titulo="Configuración"
        descripcion="Solo administración. Reúne lo que no es trabajo diario."
      >
        <ol>
          <Paso n={1} titulo="Usuarios">
            Altas, bajas y roles. Una baja desactiva, no borra: se conserva qué
            técnico hizo cada visita.
          </Paso>
          <Paso n={2} titulo="Acceso a los clientes">
            <p>
              Un técnico ve solo los clientes de las visitas que tiene
              asignadas. Aquí se hace la excepción, técnico por técnico, si
              alguno necesita la cartera entera.
            </p>
            <p className="mt-1">
              La regla la aplica la base de datos, no la pantalla, y quitar el
              permiso tiene efecto de inmediato.
            </p>
          </Paso>
          <Paso n={3} titulo="Formularios">
            <p>
              Los campos de las tres plantillas, con un interruptor cada uno.
              Desactiva los que no apliquen: los doce huecos de número de serie
              sobran en una instalación de seis paneles.
            </p>
            <p className="mt-1">
              <strong>Desactivar no borra nada.</strong> Lo ya respondido se
              conserva y sigue apareciendo en las actas firmadas; el campo solo
              deja de pedirse en las visitas nuevas.
            </p>
          </Paso>
        </ol>
      </Seccion>

      <Seccion titulo="Dudas frecuentes">
        <Pregunta q="No me deja firmar la visita">
          Falta algún campo obligatorio, o hay una incidencia sin explicar. El
          aviso encima del botón dice cuál de las dos cosas es.
          <span className="mt-1 block">
            En el mantenimiento hay que marcar los 24 puntos. En una obra solo
            bloquean los marcados con <strong>*</strong>: los demás se dejan en
            blanco si no aplican a esa instalación — la marca de la batería
            cuando no lleva batería, por ejemplo.
          </span>
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
        titulo="Protección de datos"
        descripcion="La aplicación guarda documentos de identidad, direcciones y fotografías de viviendas. Eso son datos personales de terceros."
      >
        <ul>
          <li>
            <strong>Antes de que el cliente firme</strong>, la pantalla muestra
            la información básica de protección de datos, y el acta la repite.
            No hace falta hacer nada: ya está ahí.
          </li>
          <li>
            <strong>Las fotos son de la casa de alguien.</strong> No se
            reenvían por WhatsApp ni se guardan en la galería del móvil: se
            suben a la aplicación y ahí se quedan.
          </li>
          <li>
            <strong>Si un cliente pregunta</strong> qué datos suyos hay o pide
            que se corrijan o se borren, pásalo a administración. Hay un mes
            para responder y es gratis para él.
          </li>
        </ul>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href="/legal/privacidad" className="text-acento-contraste underline">
            Política de privacidad
          </a>
          <a href="/legal/cookies" className="text-acento-contraste underline">
            Política de cookies
          </a>
          <a href="/legal/aviso-legal" className="text-acento-contraste underline">
            Aviso legal
          </a>
        </p>
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
                  Ver y rellenar <strong>solo sus visitas</strong>, del
                  formulario que sean. Los datos del cliente le llegan dentro
                  de la visita: no consulta la cartera ni programa trabajo.
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
                  Lo anterior, más todo lo de <strong>Configuración</strong>:
                  usuarios, permisos de acceso y los catálogos de los tres
                  formularios.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Seccion>
    </main>
  );
}
