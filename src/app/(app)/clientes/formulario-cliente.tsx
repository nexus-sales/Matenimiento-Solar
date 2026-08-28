"use client";

import { useMemo } from "react";
import {
  ISLAS_CANARIAS,
  desajusteCodigoPostal,
  provinciaDeIsla,
} from "@/lib/islas";

/**
 * La ficha de cliente en formato formulario. Todos los campos viajan como
 * texto: es lo que devuelve un <input>, y la conversión a número o a null
 * la hace el servidor con el mismo esquema que valida el alta y la
 * edición. Así el formulario no puede dar por buena una ficha que la API
 * vaya a rechazar, ni al revés.
 */
export type ClienteFormulario = {
  fechaAlta: string;
  nombre: string;
  documento: string;
  direccion: string;
  poblacion: string;
  codigoPostal: string;
  isla: string;
  email: string;
  telefono: string;
  cups: string;
  potenciaContratada: string;
  potenciaNominal: string;
  marcaInversor: string;
  numeroInversor: string;
  comercializadora: string;
  tieneBateria: boolean;
  tieneMantenimiento: boolean;
  comentarios: string;
};

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formularioVacio(): ClienteFormulario {
  return {
    fechaAlta: hoyISO(),
    nombre: "",
    documento: "",
    direccion: "",
    poblacion: "",
    codigoPostal: "",
    isla: "",
    email: "",
    telefono: "",
    cups: "",
    potenciaContratada: "",
    potenciaNominal: "",
    marcaInversor: "",
    numeroInversor: "",
    comercializadora: "",
    tieneBateria: false,
    tieneMantenimiento: false,
    comentarios: "",
  };
}

/** Convierte lo que devuelve la API en lo que espera el formulario. */
export function formularioDesdeCliente(
  c: Record<string, unknown>
): ClienteFormulario {
  const texto = (v: unknown) => (v == null ? "" : String(v));
  return {
    fechaAlta: texto(c.fechaAlta) || hoyISO(),
    nombre: texto(c.nombre),
    documento: texto(c.documento),
    direccion: texto(c.direccion),
    poblacion: texto(c.poblacion),
    codigoPostal: texto(c.codigoPostal),
    isla: texto(c.isla),
    email: texto(c.email),
    telefono: texto(c.telefono),
    cups: texto(c.cups),
    potenciaContratada: texto(c.potenciaContratada),
    potenciaNominal: texto(c.potenciaNominal),
    marcaInversor: texto(c.marcaInversor),
    numeroInversor: texto(c.numeroInversor),
    comercializadora: texto(c.comercializadora),
    tieneBateria: Boolean(c.tieneBateria),
    tieneMantenimiento: Boolean(c.tieneMantenimiento),
    comentarios: texto(c.comentarios),
  };
}

/** Cuerpo JSON que espera la API a partir del formulario. */
export function cuerpoCliente(v: ClienteFormulario) {
  return {
    fechaAlta: v.fechaAlta || undefined,
    nombre: v.nombre,
    documento: v.documento,
    direccion: v.direccion,
    poblacion: v.poblacion,
    codigoPostal: v.codigoPostal,
    isla: v.isla,
    email: v.email,
    telefono: v.telefono,
    cups: v.cups,
    potenciaContratada: v.potenciaContratada,
    potenciaNominal: v.potenciaNominal,
    marcaInversor: v.marcaInversor,
    numeroInversor: v.numeroInversor,
    comercializadora: v.comercializadora,
    tieneBateria: v.tieneBateria,
    tieneMantenimiento: v.tieneMantenimiento,
    comentarios: v.comentarios,
  };
}

const CLASE_CAMPO =
  "w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none";

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
    <section className="border-t border-borde pt-4 first:border-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-tenue">
        {titulo}
      </h2>
      {descripcion && (
        <p className="mt-0.5 text-xs text-tenue">{descripcion}</p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Campo({
  etiqueta,
  children,
  ancho,
  ayuda,
}: {
  etiqueta: string;
  children: React.ReactNode;
  ancho?: "completo";
  ayuda?: string;
}) {
  return (
    <div className={ancho === "completo" ? "sm:col-span-2" : undefined}>
      <label className="block text-xs text-suave mb-1">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-tenue">{ayuda}</p>}
    </div>
  );
}

/**
 * Desplegable Sí/No. El mantenimiento es una elección explícita del
 * administrador, no una casilla que se queda sin marcar por descuido: "no
 * contratado" y "todavía no lo he rellenado" no se pueden confundir.
 */
function SelectSiNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <select
      value={value ? "si" : "no"}
      onChange={(e) => onChange(e.target.value === "si")}
      className={CLASE_CAMPO}
    >
      <option value="no">No</option>
      <option value="si">Sí</option>
    </select>
  );
}

export function FormularioCliente({
  valor,
  onChange,
  onSubmit,
  onCancelar,
  guardando,
  error,
  etiquetaGuardar,
}: {
  valor: ClienteFormulario;
  onChange: (v: ClienteFormulario) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelar: () => void;
  guardando: boolean;
  error: string | null;
  etiquetaGuardar: string;
}) {
  const set = <K extends keyof ClienteFormulario>(
    campo: K,
    v: ClienteFormulario[K]
  ) => onChange({ ...valor, [campo]: v });

  // La provincia no se pregunta: la determina la isla. Se muestra para que
  // el administrador vea qué se va a guardar, pero no es editable.
  const provincia = provinciaDeIsla(valor.isla);

  // Aviso mientras se teclea, no solo al enviar. El servidor rechaza
  // igualmente un 38xxx en Lanzarote, pero verlo antes ahorra el viaje.
  const avisoCP = useMemo(
    () => desajusteCodigoPostal(valor.codigoPostal, valor.isla),
    [valor.codigoPostal, valor.isla]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-lg border border-borde bg-superficie p-5"
    >
      <Seccion titulo="Alta">
        <Campo etiqueta="Fecha de alta">
          <input
            type="date"
            value={valor.fechaAlta}
            onChange={(e) => set("fechaAlta", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Identificación y contacto">
        <Campo etiqueta="Cliente *">
          <input
            required
            value={valor.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Documento *" ayuda="NIF, NIE o CIF">
          <input
            required
            value={valor.documento}
            onChange={(e) => set("documento", e.target.value.toUpperCase())}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Dirección" ancho="completo">
          <input
            value={valor.direccion}
            onChange={(e) => set("direccion", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Población" ayuda="Municipio o localidad">
          <input
            value={valor.poblacion}
            onChange={(e) => set("poblacion", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Código postal">
          <input
            inputMode="numeric"
            maxLength={5}
            value={valor.codigoPostal}
            onChange={(e) =>
              set("codigoPostal", e.target.value.replace(/[^0-9]/g, ""))
            }
            className={CLASE_CAMPO}
          />
          {avisoCP && (
            <p className="mt-1 text-xs text-aviso-contraste">{avisoCP}</p>
          )}
        </Campo>
        <Campo etiqueta="Isla">
          <select
            value={valor.isla}
            onChange={(e) => set("isla", e.target.value)}
            className={CLASE_CAMPO}
          >
            <option value="">— Selecciona isla —</option>
            {ISLAS_CANARIAS.map((isla) => (
              <option key={isla} value={isla}>
                {isla}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Provincia" ayuda="Se asigna sola según la isla">
          <input
            value={provincia ?? ""}
            readOnly
            placeholder="—"
            className="w-full rounded border border-borde bg-superficie-alt p-2 text-sm text-suave"
          />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input
            value={valor.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Email" ancho="completo">
          <input
            type="email"
            value={valor.email}
            onChange={(e) => set("email", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
      </Seccion>

      <Seccion
        titulo="Instalación"
        descripcion="Datos del suministro. El resto de módulos los leen de aquí, no vuelven a pedirlos."
      >
        <Campo etiqueta="CUPS" ancho="completo">
          <input
            value={valor.cups}
            onChange={(e) => set("cups", e.target.value.toUpperCase())}
            placeholder="ES0000000000000000XX"
            className={`${CLASE_CAMPO} font-mono`}
          />
        </Campo>
        <Campo etiqueta="Potencia contratada (kW)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor.potenciaContratada}
            onChange={(e) => set("potenciaContratada", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Potencia nominal (kW)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor.potenciaNominal}
            onChange={(e) => set("potenciaNominal", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Marca del inversor">
          <input
            value={valor.marcaInversor}
            onChange={(e) => set("marcaInversor", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Nº de serie del inversor">
          <input
            value={valor.numeroInversor}
            onChange={(e) => set("numeroInversor", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Comercializadora">
          <input
            value={valor.comercializadora}
            onChange={(e) => set("comercializadora", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Batería">
          <SelectSiNo
            value={valor.tieneBateria}
            onChange={(v) => set("tieneBateria", v)}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Servicio">
        <Campo
          etiqueta="Mantenimiento"
          ayuda="Si tiene contratado el mantenimiento periódico"
        >
          <SelectSiNo
            value={valor.tieneMantenimiento}
            onChange={(v) => set("tieneMantenimiento", v)}
          />
        </Campo>
        <Campo etiqueta="Comentarios" ancho="completo">
          <textarea
            rows={3}
            value={valor.comentarios}
            onChange={(e) => set("comentarios", e.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
      </Seccion>

      {error && (
        <p className="rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-borde pt-4">
        <button
          type="submit"
          disabled={guardando}
          className="rounded bg-acento px-4 py-2 text-sm text-acento-encima hover:bg-acento-hover disabled:opacity-50"
        >
          {guardando ? "Guardando…" : etiquetaGuardar}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded border border-borde-fuerte px-4 py-2 text-sm text-medio hover:bg-superficie-alt"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
