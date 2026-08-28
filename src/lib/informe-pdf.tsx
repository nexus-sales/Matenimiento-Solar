/* eslint-disable jsx-a11y/alt-text -- El `Image` de aquí es una primitiva de
   @react-pdf/renderer, no una etiqueta <img> de HTML: dibuja en un documento
   impreso, donde no hay lector de pantalla ni atributo `alt`. */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  NOMBRE_CATEGORIA,
  type Categoria,
  type EstadoPunto,
} from "@/lib/checklist";

/**
 * Acta de mantenimiento en PDF.
 *
 * Sigue la estructura de los informes que aportó el cliente: datos, el
 * recorrido punto por punto con sus fotos, y las dos firmas al final.
 *
 * Se genera a partir de una visita YA FIRMADA, cuyo contenido es inmutable.
 * Eso es lo que permite guardarlo tras generarlo la primera vez: el
 * documento no puede quedar desactualizado porque los datos no cambian.
 */

// Los colores no salen de los tokens de la interfaz: un PDF se imprime en
// papel blanco y se lee en cualquier visor. Aquí no hay tema oscuro.
const OLIVA = "#6d7c0f";
const TINTA = "#1a1d17";
const SUAVE = "#5c6156";
const TENUE = "#8b9084";
const LINEA = "#d8dcd0";

const e = StyleSheet.create({
  pagina: {
    paddingTop: 36,
    paddingBottom: 46,
    paddingHorizontal: 40,
    fontSize: 9,
    color: TINTA,
    fontFamily: "Helvetica",
  },

  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: OLIVA,
    paddingBottom: 8,
    marginBottom: 14,
  },
  marca: { fontSize: 14, fontFamily: "Helvetica-Bold", color: OLIVA },
  subtitulo: { fontSize: 8, color: SUAVE, marginTop: 2 },
  referencia: { fontSize: 7, color: TENUE, textAlign: "right" },

  seccion: { marginTop: 12 },
  tituloSeccion: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: OLIVA,
    letterSpacing: 0.6,
    marginBottom: 5,
  },

  fila: { flexDirection: "row", flexWrap: "wrap" },
  dato: { width: "50%", marginBottom: 4, paddingRight: 8 },
  datoAncho: { width: "100%", marginBottom: 4 },
  etiqueta: { fontSize: 7, color: TENUE, marginBottom: 1 },
  valor: { fontSize: 9 },

  bloque: { marginTop: 10 },
  tituloBloque: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#f0f2e6",
    color: TINTA,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },

  punto: {
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  puntoCabecera: { flexDirection: "row", justifyContent: "space-between" },
  puntoNombre: { flex: 1, paddingRight: 8 },
  estado: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  observacion: {
    fontSize: 8,
    color: SUAVE,
    marginTop: 3,
    paddingLeft: 6,
    borderLeftWidth: 1.5,
    borderLeftColor: LINEA,
  },

  fotos: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, gap: 4 },
  foto: {
    width: 108,
    height: 81,
    objectFit: "cover",
    borderWidth: 0.5,
    borderColor: LINEA,
  },

  firmas: { flexDirection: "row", gap: 24, marginTop: 16 },
  firma: { flex: 1 },
  lienzoFirma: {
    height: 60,
    borderWidth: 0.5,
    borderColor: LINEA,
    marginBottom: 4,
  },
  imagenFirma: { height: 58, objectFit: "contain" },

  pie: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: TENUE,
    borderTopWidth: 0.5,
    borderTopColor: LINEA,
    paddingTop: 5,
  },
});

/** Un estado sin ambigüedad en blanco y negro: el color no basta impreso. */
const MARCA_ESTADO: Record<EstadoPunto, string> = {
  correcto: "OK",
  incidencia: "INCIDENCIA",
  no_aplica: "N/A",
  sin_revisar: "—",
};

const COLOR_ESTADO: Record<EstadoPunto, string> = {
  correcto: OLIVA,
  incidencia: "#b3261e",
  no_aplica: TENUE,
  sin_revisar: TENUE,
};

export type DatosInforme = {
  visita: {
    id: string;
    tipo: "semestral" | "anual";
    fechaPrevista: string;
    fechaEjecucion: string | null;
    numeroFactura: string | null;
    comentariosGenerales: string | null;
    equiposReemplazados: string | null;
    firmaTecnico: string | null;
    firmanteTecnicoNombre: string | null;
    firmanteTecnicoDocumento: string | null;
    firmaCliente: string | null;
    firmanteClienteNombre: string | null;
    firmanteClienteDocumento: string | null;
    firmadoEn: string | null;
  };
  cliente: {
    nombre: string;
    documento: string;
    direccion: string | null;
    poblacion: string | null;
    codigoPostal: string | null;
    isla: string | null;
    provincia: string | null;
    telefono: string | null;
    email: string | null;
    cups: string | null;
    potenciaNominal: string | null;
    potenciaContratada: string | null;
    marcaInversor: string | null;
    numeroInversor: string | null;
    comercializadora: string | null;
    tieneBateria: boolean;
  };
  tecnico: string | null;
  bloques: {
    categoria: Categoria;
    observacion: string | null;
    puntos: {
      nombre: string;
      periodicidadMeses: number;
      estado: EstadoPunto;
      observacion: string | null;
      /** Imágenes ya descargadas, como data URI: react-pdf no va a la red. */
      fotos: string[];
    }[];
  }[];
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const solo = iso.slice(0, 10);
  const [a, m, d] = solo.split("-");
  return d && m && a ? `${d}/${m}/${a}` : solo;
}

function Dato({
  etiqueta,
  valor,
  ancho,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  ancho?: boolean;
}) {
  return (
    <View style={ancho ? e.datoAncho : e.dato}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <Text style={e.valor}>{valor || "—"}</Text>
    </View>
  );
}

export function InformeMantenimiento({ datos }: { datos: DatosInforme }) {
  const { visita, cliente, tecnico, bloques } = datos;

  const direccion = [
    cliente.direccion,
    [cliente.codigoPostal, cliente.poblacion].filter(Boolean).join(" "),
    cliente.isla,
  ]
    .filter(Boolean)
    .join(" · ");

  const incidencias = bloques
    .flatMap((b) => b.puntos)
    .filter((p) => p.estado === "incidencia");

  return (
    <Document
      title={`Acta de mantenimiento — ${cliente.nombre}`}
      author="SR Energía"
      subject={`Visita ${visita.tipo} de ${fecha(visita.fechaEjecucion)}`}
    >
      <Page size="A4" style={e.pagina}>
        <View style={e.cabecera} fixed>
          <View>
            <Text style={e.marca}>SR Energía</Text>
            <Text style={e.subtitulo}>
              Acta de mantenimiento de instalación fotovoltaica
            </Text>
          </View>
          <View>
            <Text style={e.referencia}>
              Visita {visita.tipo} · {fecha(visita.fechaEjecucion)}
            </Text>
            <Text style={e.referencia}>Ref. {visita.id.slice(0, 8)}</Text>
          </View>
        </View>

        <View style={e.seccion}>
          <Text style={e.tituloSeccion}>CLIENTE</Text>
          <View style={e.fila}>
            <Dato etiqueta="Nombre" valor={cliente.nombre} />
            <Dato etiqueta="Documento" valor={cliente.documento} />
            <Dato etiqueta="Dirección" valor={direccion} ancho />
            <Dato etiqueta="Teléfono" valor={cliente.telefono} />
            <Dato etiqueta="Email" valor={cliente.email} />
          </View>
        </View>

        <View style={e.seccion}>
          <Text style={e.tituloSeccion}>INSTALACIÓN</Text>
          <View style={e.fila}>
            <Dato etiqueta="CUPS" valor={cliente.cups} ancho />
            <Dato
              etiqueta="Potencia nominal"
              valor={cliente.potenciaNominal ? `${cliente.potenciaNominal} kW` : null}
            />
            <Dato
              etiqueta="Potencia contratada"
              valor={
                cliente.potenciaContratada
                  ? `${cliente.potenciaContratada} kW`
                  : null
              }
            />
            <Dato
              etiqueta="Inversor"
              valor={[cliente.marcaInversor, cliente.numeroInversor]
                .filter(Boolean)
                .join(" · ")}
            />
            <Dato etiqueta="Comercializadora" valor={cliente.comercializadora} />
            <Dato etiqueta="Batería" valor={cliente.tieneBateria ? "Sí" : "No"} />
          </View>
        </View>

        <View style={e.seccion}>
          <Text style={e.tituloSeccion}>VISITA</Text>
          <View style={e.fila}>
            <Dato etiqueta="Fecha prevista" valor={fecha(visita.fechaPrevista)} />
            <Dato
              etiqueta="Fecha de ejecución"
              valor={fecha(visita.fechaEjecucion)}
            />
            <Dato etiqueta="Técnico" valor={tecnico} />
            <Dato etiqueta="Nº de factura" valor={visita.numeroFactura} />
          </View>
        </View>

        {/* El resumen de incidencias va arriba a propósito: es lo que la
            oficina necesita ver sin recorrer las 24 filas. */}
        {incidencias.length > 0 && (
          <View style={e.seccion}>
            <Text style={e.tituloSeccion}>
              INCIDENCIAS DETECTADAS ({incidencias.length})
            </Text>
            {incidencias.map((p, i) => (
              <View key={i} style={{ marginBottom: 3 }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>
                  {p.nombre}
                </Text>
                {p.observacion && (
                  <Text style={{ fontSize: 8, color: SUAVE }}>
                    {p.observacion}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={e.seccion}>
          <Text style={e.tituloSeccion}>REGISTRO DE MANTENIMIENTO</Text>

          {bloques.map((bloque) => (
            <View key={bloque.categoria} style={e.bloque} wrap={false}>
              <Text style={e.tituloBloque}>
                {NOMBRE_CATEGORIA[bloque.categoria]}
              </Text>

              {bloque.puntos.map((punto, i) => (
                <View key={i} style={e.punto} wrap={false}>
                  <View style={e.puntoCabecera}>
                    <Text style={e.puntoNombre}>
                      {punto.nombre}
                      <Text style={{ color: TENUE }}>
                        {"  "}
                        {punto.periodicidadMeses} meses
                      </Text>
                    </Text>
                    <Text
                      style={[
                        e.estado,
                        { color: COLOR_ESTADO[punto.estado] },
                      ]}
                    >
                      {MARCA_ESTADO[punto.estado]}
                    </Text>
                  </View>

                  {punto.observacion && (
                    <Text style={e.observacion}>{punto.observacion}</Text>
                  )}

                  {punto.fotos.length > 0 && (
                    <View style={e.fotos}>
                      {punto.fotos.map((src, j) => (
                        <Image key={j} src={src} style={e.foto} />
                      ))}
                    </View>
                  )}
                </View>
              ))}

              {bloque.observacion && (
                <Text style={[e.observacion, { marginLeft: 5 }]}>
                  {bloque.observacion}
                </Text>
              )}
            </View>
          ))}
        </View>

        {(visita.comentariosGenerales || visita.equiposReemplazados) && (
          <View style={e.seccion}>
            <Text style={e.tituloSeccion}>OBSERVACIONES</Text>
            {visita.comentariosGenerales && (
              <Text style={{ marginBottom: 4 }}>
                {visita.comentariosGenerales}
              </Text>
            )}
            {visita.equiposReemplazados && (
              <>
                <Text style={e.etiqueta}>Equipos reemplazados</Text>
                <Text>{visita.equiposReemplazados}</Text>
              </>
            )}
          </View>
        )}

        <View style={e.seccion} wrap={false}>
          <Text style={e.tituloSeccion}>CONFORMIDAD</Text>
          <View style={e.firmas}>
            <View style={e.firma}>
              <View style={e.lienzoFirma}>
                {visita.firmaTecnico && (
                  <Image src={visita.firmaTecnico} style={e.imagenFirma} />
                )}
              </View>
              <Text style={e.etiqueta}>Por SR Energía</Text>
              <Text style={e.valor}>{visita.firmanteTecnicoNombre || "—"}</Text>
              <Text style={{ fontSize: 8, color: SUAVE }}>
                {visita.firmanteTecnicoDocumento || ""}
              </Text>
            </View>

            <View style={e.firma}>
              <View style={e.lienzoFirma}>
                {visita.firmaCliente && (
                  <Image src={visita.firmaCliente} style={e.imagenFirma} />
                )}
              </View>
              <Text style={e.etiqueta}>Por el cliente</Text>
              <Text style={e.valor}>{visita.firmanteClienteNombre || "—"}</Text>
              <Text style={{ fontSize: 8, color: SUAVE }}>
                {visita.firmanteClienteDocumento || ""}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 8, color: SUAVE, marginTop: 8 }}>
            Firmado el {fecha(visita.firmadoEn)}.
          </Text>
        </View>

        <View style={e.pie} fixed>
          <Text>
            SR Energía · Acta de mantenimiento · {cliente.nombre}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
