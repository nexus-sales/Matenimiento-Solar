"use client";

import { ESTADOS_PUNTO, NOMBRE_ESTADO, type EstadoPunto } from "@/lib/checklist";
import { FotosPunto } from "./fotos-punto";

/**
 * Un campo del formulario, pintado según su tipo.
 *
 * El checklist de mantenimiento se responde con cuatro botones de estado.
 * La visita previa mide secciones en mm² y elige entre monofásico y
 * trifásico. El acta es, casi entera, subir la foto correcta. Los tres son
 * el mismo formulario y la misma tabla: lo único que cambia es el control
 * que se dibuja.
 *
 * Todo se guarda al salir del campo, no al pulsar un botón de guardar: se
 * trabaja en una cubierta, con mala cobertura, y perder lo escrito por no
 * haber confirmado al final no es aceptable.
 */

export type Campo = {
  id: string;
  categoria: string;
  nombre: string;
  tipo: "estado" | "foto" | "texto" | "numero" | "medida" | "si_no" | "lista";
  obligatorio: boolean;
  unidad: string | null;
  opciones: string[] | null;
  ayuda: string | null;
  periodicidadMeses: number | null;
  orden: number;
};

export type RespuestaCampo = {
  id: string;
  estado: EstadoPunto;
  valor: string | null;
  observacion: string | null;
} | null;

export type FilaCampo = {
  item: Campo;
  respuesta: RespuestaCampo;
  fotos: { id: string; pie: string | null }[];
};

const ESTILO_ESTADO: Record<EstadoPunto, string> = {
  sin_revisar: "border-borde-fuerte text-suave",
  correcto: "border-acento bg-acento-suave text-acento-contraste",
  incidencia: "border-peligro-borde bg-peligro-suave text-peligro-contraste",
  no_aplica: "border-borde bg-superficie-fuerte text-tenue",
};

const CLASE_ENTRADA =
  "w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm " +
  "focus:border-acento focus:outline-none disabled:opacity-60";

/**
 * Si un campo cuenta ya como respondido. Es lo que alimenta el contador de
 * progreso y lo que decide si se puede firmar, así que tiene que decir la
 * verdad por tipo: un campo de foto sin foto no está hecho, aunque tenga
 * una fila en la base creada al subir una y borrarla después.
 */
export function campoRespondido(fila: FilaCampo): boolean {
  const { tipo } = fila.item;
  if (tipo === "estado") {
    return !!fila.respuesta && fila.respuesta.estado !== "sin_revisar";
  }
  if (tipo === "foto") return fila.fotos.length > 0;
  return !!fila.respuesta?.valor?.trim();
}

export function CampoRespuesta({
  fila,
  intervencionId,
  bloqueado,
  onGuardar,
  onCambioFotos,
}: {
  fila: FilaCampo;
  intervencionId: string;
  bloqueado: boolean;
  onGuardar: (
    fila: FilaCampo,
    cambios: {
      estado?: EstadoPunto;
      valor?: string | null;
      observacion?: string | null;
    }
  ) => void;
  onCambioFotos: () => void;
}) {
  const { item, respuesta } = fila;
  const estado = respuesta?.estado ?? "sin_revisar";
  const valor = respuesta?.valor ?? "";

  // Solo el checklist de mantenimiento lleva estados, y con ellos el flujo
  // de incidencia. En los demás tipos la observación es una nota libre.
  const esChecklist = item.tipo === "estado";

  // La observación se muestra siempre salvo en el checklist, donde aparecer
  // sin motivo bajo los 24 puntos sería ruido: allí sale al marcar una
  // incidencia, o si ya hay algo escrito.
  const mostrarObservacion =
    !esChecklist || estado === "incidencia" || !!respuesta?.observacion;

  return (
    <div className="p-3">
      <p className="text-sm text-texto">
        {item.nombre}
        {item.obligatorio && (
          <span className="ml-1 text-peligro-contraste" title="Obligatorio">
            *
          </span>
        )}
        {item.periodicidadMeses !== null && (
          <span className="ml-2 text-xs text-tenue">
            {item.periodicidadMeses} meses
          </span>
        )}
      </p>

      {item.ayuda && <p className="mt-0.5 text-xs text-tenue">{item.ayuda}</p>}

      {esChecklist && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ESTADOS_PUNTO.filter((e) => e !== "sin_revisar").map((opcion) => (
            <button
              key={opcion}
              type="button"
              disabled={bloqueado}
              onClick={() => onGuardar(fila, { estado: opcion })}
              className={`rounded-full border px-2.5 py-1 text-xs disabled:opacity-60 ${
                estado === opcion
                  ? ESTILO_ESTADO[opcion]
                  : "border-borde text-suave hover:border-borde-fuerte"
              }`}
            >
              {NOMBRE_ESTADO[opcion]}
            </button>
          ))}
        </div>
      )}

      {item.tipo === "si_no" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Sí", "No"].map((opcion) => (
            <button
              key={opcion}
              type="button"
              disabled={bloqueado}
              // Volver a pulsar la opción marcada la deselecciona: es la
              // única forma de dejar en blanco algo que se marcó por error.
              onClick={() =>
                onGuardar(fila, { valor: valor === opcion ? null : opcion })
              }
              className={`rounded-full border px-3 py-1 text-xs disabled:opacity-60 ${
                valor === opcion
                  ? "border-acento bg-acento-suave text-acento-contraste"
                  : "border-borde text-suave hover:border-borde-fuerte"
              }`}
            >
              {opcion}
            </button>
          ))}
        </div>
      )}

      {item.tipo === "lista" && (
        <select
          disabled={bloqueado}
          value={valor}
          onChange={(e) => onGuardar(fila, { valor: e.target.value || null })}
          className={`mt-2 ${CLASE_ENTRADA}`}
        >
          <option value="">Sin elegir</option>
          {(item.opciones ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {item.tipo === "texto" && (
        <textarea
          rows={2}
          disabled={bloqueado}
          defaultValue={valor}
          onBlur={(e) => onGuardar(fila, { valor: e.target.value || null })}
          className={`mt-2 ${CLASE_ENTRADA}`}
        />
      )}

      {(item.tipo === "numero" || item.tipo === "medida") && (
        <div className="mt-2 flex items-center gap-2">
          <input
            // El número abre el teclado numérico del móvil, pero se guarda
            // como texto igual que la medida: una medida es "6.40 x 3.90" y
            // una sección "25mm²". Forzar un tipo numérico perdería el dato.
            inputMode={item.tipo === "numero" ? "decimal" : "text"}
            disabled={bloqueado}
            defaultValue={valor}
            placeholder={item.tipo === "medida" ? "ej. 6.40 x 3.90" : ""}
            onBlur={(e) => onGuardar(fila, { valor: e.target.value || null })}
            className={CLASE_ENTRADA}
          />
          {item.unidad && (
            <span className="shrink-0 text-xs text-tenue">{item.unidad}</span>
          )}
        </div>
      )}

      {mostrarObservacion && (
        <>
          <textarea
            rows={2}
            disabled={bloqueado}
            defaultValue={respuesta?.observacion ?? ""}
            placeholder={
              esChecklist && estado === "incidencia"
                ? "Qué has encontrado"
                : "Observación (opcional)"
            }
            onBlur={(e) =>
              onGuardar(fila, { observacion: e.target.value || null })
            }
            className={`mt-2 ${CLASE_ENTRADA}`}
          />
          {esChecklist &&
            estado === "incidencia" &&
            !respuesta?.observacion?.trim() && (
              <p className="mt-1 text-xs text-aviso-contraste">
                Explica la incidencia: sin esto no se puede firmar la visita.
              </p>
            )}
        </>
      )}

      <FotosPunto
        intervencionId={intervencionId}
        itemId={item.id}
        fotos={fila.fotos}
        bloqueado={bloqueado}
        onCambio={onCambioFotos}
      />

      {item.tipo === "foto" && item.obligatorio && fila.fotos.length === 0 && (
        <p className="mt-1 text-xs text-aviso-contraste">
          Falta la foto: sin ella no se puede firmar.
        </p>
      )}
    </div>
  );
}
