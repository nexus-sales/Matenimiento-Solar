import type { Metadata } from "next";
import {
  CATEGORIAS_DATOS,
  CONSERVACION,
  ALOJAMIENTO,
  ENCARGADO,
  MEDIDAS_SEGURIDAD,
  RESPONSABLE,
} from "@/lib/legal";
import { Dato, Responsable } from "../componentes";

export const metadata: Metadata = {
  title: "Política de privacidad — SR Energía",
  description:
    "Qué datos personales trata la aplicación de mantenimiento, para qué, " +
    "durante cuánto tiempo y cómo ejercer tus derechos.",
};

export default function PrivacidadPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Política de privacidad</h1>
      <p className="text-suave">
        Esta aplicación gestiona las visitas técnicas de {RESPONSABLE.nombre} a
        instalaciones fotovoltaicas. Aquí se explica qué datos personales trata,
        para qué y qué puedes hacer al respecto.
      </p>

      <h2>Quién es responsable de tus datos</h2>
      <Responsable />
      <p>
        {RESPONSABLE.nombre} decide qué datos se recogen y para qué. La
        aplicación la desarrolla y mantiene {ENCARGADO.nombre}, que actúa como{" "}
        <em>encargado del tratamiento</em>: solo puede tratar los datos
        siguiendo las instrucciones de {RESPONSABLE.nombre}, y no los usa para
        ningún fin propio.
      </p>

      <h2>Qué datos se tratan</h2>
      {CATEGORIAS_DATOS.map((c) => (
        <div key={c.grupo}>
          <h3>{c.grupo}</h3>
          <p>
            {c.datos} <span className="text-suave">{c.origen}</span>
          </p>
        </div>
      ))}
      <p>
        <strong>No se tratan categorías especiales de datos</strong> —salud,
        ideología, biometría— ni se elaboran perfiles, ni se toman decisiones
        automatizadas que te afecten.
      </p>
      <p>
        La firma que se recoge es una <strong>imagen del trazo</strong>, como la
        de un albarán en papel. No se registra la presión, la velocidad ni
        ningún otro rasgo que la convertiría en un dato biométrico.
      </p>

      <h2>Para qué y con qué legitimación</h2>
      <ul>
        <li>
          <strong>Ejecutar el contrato de mantenimiento o de obra</strong>{" "}
          (artículo 6.1.b del RGPD): programar la visita, realizarla, dejar
          constancia de lo revisado y emitir el acta que ambas partes firman.
        </li>
        <li>
          <strong>Cumplir obligaciones legales</strong> (artículo 6.1.c):
          conservar la documentación fiscal y mercantil asociada a la
          facturación.
        </li>
        <li>
          <strong>Interés legítimo</strong> (artículo 6.1.f): acreditar el
          estado de la instalación en cada visita, mediante fotografías, para
          poder atender garantías y reclamaciones posteriores. Es el mismo
          motivo por el que se archiva un albarán firmado.
        </li>
      </ul>
      <p>
        Facilitar estos datos es necesario para poder prestar el servicio. Sin
        ellos no es posible identificar la instalación, acudir a ella ni emitir
        el acta.
      </p>

      <h2>Quién más accede a ellos</h2>
      <p>
        <strong>No se ceden a terceros</strong> ni se venden, y no hay
        transferencias fuera del Espacio Económico Europeo.
      </p>
      <p>Acceden únicamente:</p>
      <ul>
        <li>
          El personal de {RESPONSABLE.nombre} autorizado. El técnico solo ve los
          datos de los clientes cuyas visitas tiene asignadas.
        </li>
        <li>
          {ENCARGADO.nombre}, como encargado del tratamiento, para el
          mantenimiento técnico de la aplicación.
        </li>
        <li>
          {ALOJAMIENTO.proveedor}, como proveedor de alojamiento, con los
          servidores situados en {ALOJAMIENTO.ubicacion}.
        </li>
      </ul>

      <h2>Cuánto tiempo se conservan</h2>
      <p>{CONSERVACION}</p>
      <p>
        Un acta ya firmada <strong>no se modifica ni se borra</strong> mientras
        siga siendo necesaria para acreditar el trabajo realizado: es lo que le
        da valor como prueba, y está amparado por el artículo 17.3 del RGPD
        (cumplimiento de obligaciones legales y defensa de reclamaciones). Si se
        firmó por error, se anula dejando constancia del motivo, pero su
        contenido se conserva.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de <strong>acceso</strong>,{" "}
        <strong>rectificación</strong>, <strong>supresión</strong>,{" "}
        <strong>oposición</strong>, <strong>limitación</strong> del tratamiento
        y <strong>portabilidad</strong> escribiendo a{" "}
        <Dato valor={RESPONSABLE.email} que="email de contacto" />, indicando
        cuál de ellos ejerces y acreditando tu identidad.
      </p>
      <p>
        La respuesta llegará en el plazo de un mes. El ejercicio de estos
        derechos es gratuito.
      </p>
      <p>
        Si consideras que tus datos no se han tratado correctamente, puedes
        reclamar ante la <strong>Agencia Española de Protección de Datos</strong>{" "}
        (
        <a
          href="https://www.aepd.es"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.aepd.es
        </a>
        ), C/ Jorge Juan 6, 28001 Madrid.
      </p>

      <h2>Cómo se protegen</h2>
      <p>
        Las medidas técnicas y organizativas aplicadas, en cumplimiento del
        artículo 32 del RGPD:
      </p>
      <ul>
        {MEDIDAS_SEGURIDAD.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <p>
        Si llegara a producirse una brecha de seguridad con riesgo para tus
        derechos, {RESPONSABLE.nombre} la notificará a la Agencia Española de
        Protección de Datos en un plazo de 72 horas y, cuando el riesgo sea
        alto, también a las personas afectadas.
      </p>

      <h2>Cambios en esta política</h2>
      <p>
        Si el tratamiento cambia de forma relevante, esta página se actualizará
        y se modificará la fecha que aparece al pie.
      </p>
    </>
  );
}
