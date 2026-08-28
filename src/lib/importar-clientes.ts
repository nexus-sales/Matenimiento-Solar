import ExcelJS from "exceljs";
import { esquemaCliente, type DatosCliente } from "@/lib/esquemas";

/**
 * Lectura y validación de un Excel de clientes.
 *
 * Analiza sin escribir. Quien llama decide después qué hacer con el
 * resultado: una importación masiva que empieza a escribir antes de que
 * nadie haya visto qué va a pasar es una forma rápida de ensuciar la base.
 */

/** Cómo se llama cada columna en el archivo, y a qué campo corresponde. */
const ALIAS: Record<string, keyof DatosCliente | "ignorada"> = {
  // Identificación y contacto
  cliente: "nombre",
  nombre: "nombre",
  "nombre y apellidos": "nombre",
  documento: "documento",
  dni: "documento",
  "dni/nif": "documento",
  nif: "documento",
  direccion: "direccion",
  poblacion: "poblacion",
  municipio: "poblacion",
  localidad: "poblacion",
  "codigo postal": "codigoPostal",
  cp: "codigoPostal",
  isla: "isla",
  email: "email",
  correo: "email",
  telefono: "telefono",
  telf: "telefono",
  "fecha alta": "fechaAlta",

  // Instalación
  cups: "cups",
  "potencia nominal": "potenciaNominal",
  "p nominal": "potenciaNominal",
  "potencia contratada": "potenciaContratada",
  "p contratada": "potenciaContratada",
  "marca inversor": "marcaInversor",
  "numero inversor": "numeroInversor",
  "n serie inversor": "numeroInversor",
  comercializadora: "comercializadora",
  bateria: "tieneBateria",

  // Servicio
  mantenimiento: "tieneMantenimiento",
  comentarios: "comentarios",

  // La provincia se calcula desde la isla: si viene en el archivo se ignora
  // para que no pueda contradecir a su propia isla.
  provincia: "ignorada",
  // Cita y ejecución son de una visita, no del cliente.
  cita: "ignorada",
  ejecucion: "ignorada",
};

export type FilaAnalizada = {
  /** Número de fila en el archivo, para que el usuario la localice. */
  fila: number;
  nombre: string;
  documento: string;
  /** `nuevo`, `existente` (ya hay un cliente con ese documento) o `error`. */
  estado: "nuevo" | "existente" | "error";
  errores: string[];
  datos: DatosCliente | null;
};

export type AnalisisImportacion = {
  columnasReconocidas: string[];
  columnasIgnoradas: string[];
  filas: FilaAnalizada[];
  /** Documentos que aparecen más de una vez EN EL PROPIO ARCHIVO. */
  duplicadosEnArchivo: string[];
};

/** Quita acentos y espacios sobrantes para comparar cabeceras. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Un sí/no escrito de las muchas formas en que se escribe en una hoja. */
function comoBooleano(valor: unknown): boolean {
  const t = normalizar(String(valor ?? ""));
  return ["si", "s", "x", "true", "1", "verdadero", "yes"].includes(t);
}

/**
 * Una celda de Excel puede traer texto, número, fecha, fórmula o texto
 * enriquecido. Se reduce todo a la cadena que el usuario ve.
 */
function comoTexto(celda: ExcelJS.CellValue): string {
  if (celda === null || celda === undefined) return "";
  if (celda instanceof Date) {
    const m = String(celda.getMonth() + 1).padStart(2, "0");
    const d = String(celda.getDate()).padStart(2, "0");
    return `${celda.getFullYear()}-${m}-${d}`;
  }
  if (typeof celda === "object") {
    if ("text" in celda && typeof celda.text === "string") return celda.text;
    // Fórmula: interesa el resultado, no la fórmula.
    if ("result" in celda) return comoTexto(celda.result as ExcelJS.CellValue);
    if ("richText" in celda && Array.isArray(celda.richText)) {
      return celda.richText.map((t) => t.text).join("");
    }
    return "";
  }
  return String(celda).trim();
}

export async function analizarExcel(
  buffer: Buffer,
  documentosExistentes: Set<string>
): Promise<AnalisisImportacion> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);

  const hoja = libro.worksheets[0];
  if (!hoja) throw new Error("El archivo no tiene ninguna hoja.");

  // La cabecera no siempre está en la primera fila: puede haber un título
  // encima. Se busca la primera fila que contenga una columna reconocible.
  let filaCabecera = 0;
  let mapa: Record<number, keyof DatosCliente | "ignorada"> = {};
  const reconocidas: string[] = [];
  const ignoradas: string[] = [];

  for (let f = 1; f <= Math.min(10, hoja.rowCount); f++) {
    const candidato: Record<number, keyof DatosCliente | "ignorada"> = {};
    let aciertos = 0;

    hoja.getRow(f).eachCell((celda, col) => {
      const campo = ALIAS[normalizar(comoTexto(celda.value))];
      if (campo) {
        candidato[col] = campo;
        if (campo !== "ignorada") aciertos++;
      }
    });

    // Con tres columnas reconocidas ya no es casualidad.
    if (aciertos >= 3) {
      filaCabecera = f;
      mapa = candidato;
      hoja.getRow(f).eachCell((celda, col) => {
        const texto = comoTexto(celda.value);
        if (!texto) return;
        if (candidato[col] && candidato[col] !== "ignorada") {
          reconocidas.push(texto);
        } else {
          ignoradas.push(texto);
        }
      });
      break;
    }
  }

  if (!filaCabecera) {
    throw new Error(
      "No se reconoce la cabecera. Debe haber una fila con columnas como " +
        "Cliente, Documento o CUPS."
    );
  }

  const filas: FilaAnalizada[] = [];
  const vistos = new Map<string, number>();
  const duplicadosEnArchivo = new Set<string>();

  for (let f = filaCabecera + 1; f <= hoja.rowCount; f++) {
    const fila = hoja.getRow(f);

    const crudo: Record<string, unknown> = {};
    let vacia = true;

    for (const [colStr, campo] of Object.entries(mapa)) {
      if (campo === "ignorada") continue;
      const valor = comoTexto(fila.getCell(Number(colStr)).value);
      if (valor) vacia = false;

      if (campo === "tieneBateria" || campo === "tieneMantenimiento") {
        crudo[campo] = comoBooleano(valor);
      } else {
        crudo[campo] = valor;
      }
    }

    // Una fila en blanco no es un error: las hojas suelen arrastrarlas.
    if (vacia) continue;

    const parseo = esquemaCliente.safeParse(crudo);

    if (!parseo.success) {
      filas.push({
        fila: f,
        nombre: String(crudo.nombre ?? ""),
        documento: String(crudo.documento ?? ""),
        estado: "error",
        errores: parseo.error.issues.map(
          (i) => `${i.path.join(".") || "fila"}: ${i.message}`
        ),
        datos: null,
      });
      continue;
    }

    const doc = parseo.data.documento;
    if (vistos.has(doc)) duplicadosEnArchivo.add(doc);
    vistos.set(doc, f);

    filas.push({
      fila: f,
      nombre: parseo.data.nombre,
      documento: doc,
      estado: documentosExistentes.has(doc) ? "existente" : "nuevo",
      errores: [],
      datos: parseo.data,
    });
  }

  return {
    columnasReconocidas: reconocidas,
    columnasIgnoradas: ignoradas,
    filas,
    duplicadosEnArchivo: [...duplicadosEnArchivo],
  };
}
