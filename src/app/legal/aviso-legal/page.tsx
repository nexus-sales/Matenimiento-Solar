import type { Metadata } from "next";
import Link from "next/link";
import { ALOJAMIENTO, ENCARGADO, RESPONSABLE } from "@/lib/legal";
import { Responsable } from "../componentes";

export const metadata: Metadata = {
  title: "Aviso legal — SR Energía",
  description:
    "Titularidad, condiciones de uso y propiedad intelectual de la " +
    "aplicación de gestión de mantenimiento.",
};

export default function AvisoLegalPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Aviso legal</h1>
      <p className="text-suave">
        Información exigida por el artículo 10 de la Ley 34/2002, de servicios
        de la sociedad de la información y de comercio electrónico.
      </p>

      <h2>Titular</h2>
      <Responsable />

      <h2>Objeto</h2>
      <p>
        Esta aplicación es una <strong>herramienta interna de gestión</strong>{" "}
        de {RESPONSABLE.nombre}. No es una tienda ni un sitio abierto al
        público: no ofrece productos ni servicios a través de ella, y el acceso
        está restringido al personal autorizado mediante usuario y contraseña.
      </p>
      <p>
        Las únicas páginas accesibles sin identificarse son esta y las de{" "}
        <Link href="/legal/privacidad" className="underline">
          privacidad
        </Link>{" "}
        y{" "}
        <Link href="/legal/cookies" className="underline">
          cookies
        </Link>
        , precisamente para que puedan consultarlas las personas cuyos datos se
        tratan, que no disponen de cuenta.
      </p>

      <h2>Condiciones de uso</h2>
      <ul>
        <li>
          Las credenciales son personales e intransferibles. Quien las recibe
          responde del uso que se haga con ellas.
        </li>
        <li>
          La información contenida —fichas de clientes, fotografías y actas— es{" "}
          <strong>confidencial</strong>. No puede extraerse, copiarse ni
          comunicarse a terceros fuera de las tareas propias del puesto.
        </li>
        <li>
          Queda prohibido cualquier intento de acceder a datos ajenos al perfil
          asignado, así como alterar o interferir en el funcionamiento del
          servicio.
        </li>
        <li>
          El uso indebido puede dar lugar a responsabilidad disciplinaria, civil
          o penal, sin perjuicio de la retirada inmediata del acceso.
        </li>
      </ul>

      <h2>Propiedad intelectual</h2>
      <p>
        El programa, su código fuente, su diseño y su documentación son
        titularidad de {ENCARGADO.nombre}, que cede a {RESPONSABLE.nombre} el
        derecho de uso en los términos acordados entre ambas partes.
      </p>
      <p>
        Los <strong>datos</strong> introducidos —clientes, visitas, fotografías
        y actas— son propiedad de {RESPONSABLE.nombre}. {ENCARGADO.nombre} no
        adquiere ningún derecho sobre ellos, ni los utiliza para fines propios.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        El servicio se presta sin garantía de disponibilidad ininterrumpida.
        Puede suspenderse temporalmente por mantenimiento, actualizaciones o
        causas ajenas al titular. Los servidores están alojados en{" "}
        {ALOJAMIENTO.proveedor}, en {ALOJAMIENTO.ubicacion}.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Estas condiciones se rigen por la legislación española. Para cualquier
        controversia serán competentes los juzgados y tribunales del domicilio
        del titular, salvo que la normativa aplicable disponga otro fuero.
      </p>

      <h2>Normativa de referencia</h2>
      <ul>
        <li>
          Reglamento (UE) 2016/679, General de Protección de Datos (RGPD).
        </li>
        <li>
          Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de
          los derechos digitales (LOPDGDD).
        </li>
        <li>
          Ley 34/2002, de servicios de la sociedad de la información y de
          comercio electrónico (LSSI-CE).
        </li>
        <li>
          Directiva 2002/58/CE, sobre la privacidad en las comunicaciones
          electrónicas.
        </li>
      </ul>
    </>
  );
}
