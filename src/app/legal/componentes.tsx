import { RESPONSABLE } from "@/lib/legal";

/**
 * Un dato de la identidad legal que puede faltar.
 *
 * Si falta, se marca de forma visible en vez de omitirlo o inventarlo. Un
 * hueco que se ve se rellena; un dato falso pasa desapercibido hasta que
 * alguien lo comprueba, que es el peor momento posible.
 */
export function Dato({ valor, que }: { valor: string | null; que: string }) {
  if (valor) return <>{valor}</>;
  return (
    <span className="rounded bg-aviso-suave px-1 text-aviso-contraste">
      [pendiente: {que}]
    </span>
  );
}

/** Bloque de identificación del responsable, igual en las tres páginas. */
export function Responsable() {
  return (
    <ul>
      <li>
        <strong>Titular:</strong> {RESPONSABLE.nombre}
      </li>
      <li>
        <strong>CIF/NIF:</strong>{" "}
        <Dato valor={RESPONSABLE.cif} que="CIF" />
      </li>
      <li>
        <strong>Domicilio:</strong>{" "}
        <Dato valor={RESPONSABLE.direccion} que="domicilio" />
      </li>
      <li>
        <strong>Correo de contacto:</strong>{" "}
        <Dato valor={RESPONSABLE.email} que="email de contacto" />
      </li>
      {RESPONSABLE.telefono && (
        <li>
          <strong>Teléfono:</strong> {RESPONSABLE.telefono}
        </li>
      )}
      {RESPONSABLE.dpd && (
        <li>
          <strong>Delegado de Protección de Datos:</strong> {RESPONSABLE.dpd}
        </li>
      )}
    </ul>
  );
}
