import Link from "next/link";

export type TonoTarjeta = "neutro" | "acento" | "info" | "aviso";

const ESTILO_VALOR: Record<TonoTarjeta, string> = {
  neutro: "text-texto",
  acento: "text-acento-contraste",
  info: "text-info-contraste",
  aviso: "text-aviso-contraste",
};

const ESTILO_MARCADOR: Record<TonoTarjeta, string> = {
  neutro: "bg-borde-fuerte",
  acento: "bg-marca",
  info: "bg-info",
  aviso: "bg-aviso",
};

export default function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  tono = "neutro",
  href,
}: {
  etiqueta: string;
  valor: number | null;
  detalle?: string;
  tono?: TonoTarjeta;
  href?: string;
}) {
  const contenido = (
    <>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${ESTILO_MARCADOR[tono]}`}
        />
        <p className="text-xs font-medium tracking-wide text-suave uppercase">
          {etiqueta}
        </p>
      </div>
      <p className={`mt-3 text-3xl font-semibold ${ESTILO_VALOR[tono]}`}>
        {valor === null ? "—" : valor}
      </p>
      {detalle && <p className="mt-1 text-xs text-suave">{detalle}</p>}
    </>
  );

  const clases =
    "rounded-lg border border-borde bg-superficie p-4 block transition-colors";

  if (href) {
    return (
      <Link href={href} className={`${clases} hover:border-borde-fuerte`}>
        {contenido}
      </Link>
    );
  }

  return <div className={clases}>{contenido}</div>;
}
