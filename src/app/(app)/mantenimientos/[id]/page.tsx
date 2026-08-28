"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";
import {
  CATEGORIAS,
  ESTADOS_PUNTO,
  NOMBRE_CATEGORIA,
  NOMBRE_ESTADO,
  NOMBRE_TIPO_VISITA,
  type Categoria,
  type EstadoPunto,
} from "@/lib/checklist";
import { Firma } from "./panel-firma";
import { FotosPunto } from "./fotos-punto";

type Item = {
  id: string;
  categoria: Categoria;
  nombre: string;
  periodicidadMeses: number;
  orden: number;
};

type Respuesta = {
  id: string;
  estado: EstadoPunto;
  observacion: string | null;
} | null;

type Fila = {
  item: Item;
  respuesta: Respuesta;
  fotos: { id: string; pie: string | null }[];
};

type Visita = {
  id: string;
  tipo: "semestral" | "anual";
  fechaPrevista: string;
  fechaEjecucion: string | null;
  firmado: boolean;
  comentariosGenerales: string | null;
  equiposReemplazados: string | null;
  firmanteClienteNombre: string | null;
  firmanteTecnicoNombre: string | null;
};

type Cliente = {
  id: string;
  nombre: string;
  documento: string;
  direccion: string | null;
  poblacion: string | null;
  codigoPostal: string | null;
  isla: string | null;
  cups: string | null;
  marcaInversor: string | null;
  tieneBateria: boolean;
};

function fecha(iso: string | null) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

const ESTILO_ESTADO: Record<EstadoPunto, string> = {
  sin_revisar: "border-borde-fuerte text-suave",
  correcto: "border-acento bg-acento-suave text-acento-contraste",
  incidencia: "border-peligro-borde bg-peligro-suave text-peligro-contraste",
  no_aplica: "border-borde bg-superficie-fuerte text-tenue",
};

export default function VisitaPage() {
  const { id } = useParams<{ id: string }>();

  const [visita, setVisita] = useState<Visita | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tecnico, setTecnico] = useState<{
    id: string;
    nombre: string;
    documento: string | null;
  } | null>(null);
  const [puedeAsignar, setPuedeAsignar] = useState(false);
  const [tecnicos, setTecnicos] = useState<
    { id: string; nombre: string; isla: string | null }[]
  >([]);
  const [asignando, setAsignando] = useState(false);
  const [checklist, setChecklist] = useState<Fila[]>([]);
  const [obsBloque, setObsBloque] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firmaTecnico, setFirmaTecnico] = useState<string | null>(null);
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);
  const [datosFirma, setDatosFirma] = useState({
    tecnicoNombre: "",
    tecnicoDocumento: "",
    clienteNombre: "",
    clienteDocumento: "",
  });
  const [firmando, setFirmando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch(`/api/mantenimientos/${id}`);
    if (res.ok) {
      const d = await res.json();
      setVisita(d.visita);
      setCliente(d.cliente);
      setTecnico(d.tecnico);
      setPuedeAsignar(Boolean(d.puedeAsignar));

      // Precarga de la firma con lo que ya sabemos: el técnico asignado y
      // los datos de la ficha del cliente. Teclear un DNI ajeno en un móvil
      // subido a una cubierta es donde se cometen los errores, y la
      // validación con letra de control es estricta.
      //
      // Solo se rellena lo que esté vacío: si el usuario ya ha escrito algo
      // —porque firma otra persona, un familiar o el administrador de la
      // finca— no se le pisa.
      setDatosFirma((previo) => ({
        tecnicoNombre: previo.tecnicoNombre || (d.tecnico?.nombre ?? ""),
        tecnicoDocumento:
          previo.tecnicoDocumento || (d.tecnico?.documento ?? ""),
        clienteNombre: previo.clienteNombre || (d.cliente?.nombre ?? ""),
        clienteDocumento:
          previo.clienteDocumento || (d.cliente?.documento ?? ""),
      }));
      setTecnicos(d.tecnicos ?? []);
      setChecklist(d.checklist);
      setObsBloque(
        Object.fromEntries(
          (d.observacionesBloque ?? []).map(
            (o: { categoria: string; observacion: string | null }) => [
              o.categoria,
              o.observacion ?? "",
            ]
          )
        )
      );
      setError(null);
    } else {
      setError(await leerErrorApi(res, "No se pudo cargar la visita."));
    }
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  /** Guarda punto a punto: en una cubierta no se pulsa "guardar" al final. */
  async function guardarPunto(
    fila: Fila,
    cambios: { estado?: EstadoPunto; observacion?: string | null }
  ) {
    const estado = cambios.estado ?? fila.respuesta?.estado ?? "sin_revisar";
    const observacion =
      cambios.observacion !== undefined
        ? cambios.observacion
        : (fila.respuesta?.observacion ?? null);

    setChecklist((prev) =>
      prev.map((f) =>
        f.item.id === fila.item.id
          ? {
              ...f,
              respuesta: { id: f.respuesta?.id ?? "", estado, observacion },
            }
          : f
      )
    );

    const res = await fetch(`/api/mantenimientos/${id}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: fila.item.id, estado, observacion }),
    });

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar el punto."));
      cargar();
    } else {
      setError(null);
    }
  }

  async function guardarObservacionBloque(categoria: string, texto: string) {
    const res = await fetch(`/api/mantenimientos/${id}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoria, observacion: texto }),
    });
    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar la observación."));
    }
  }

  /** Reasignar es trabajo de oficina: el técnico no se asigna a sí mismo. */
  async function asignarTecnico(tecnicoId: string) {
    setAsignando(true);
    setError(null);

    const res = await fetch(`/api/mantenimientos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tecnicoId: tecnicoId || null }),
    });

    setAsignando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo asignar el técnico."));
      return;
    }
    cargar();
  }

  async function firmar() {
    setError(null);

    if (!firmaTecnico || !firmaCliente) {
      setError("Faltan las dos firmas: la del técnico y la del cliente.");
      return;
    }

    setFirmando(true);
    const hoy = new Date();
    const res = await fetch(`/api/mantenimientos/${id}/firma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fechaEjecucion: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
        tecnico: {
          nombre: datosFirma.tecnicoNombre,
          documento: datosFirma.tecnicoDocumento,
          firma: firmaTecnico,
        },
        cliente: {
          nombre: datosFirma.clienteNombre,
          documento: datosFirma.clienteDocumento,
          firma: firmaCliente,
        },
      }),
    });
    setFirmando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo firmar la visita."));
      return;
    }
    cargar();
  }

  if (cargando) return <p className="p-8 text-sm text-suave">Cargando…</p>;

  if (!visita || !cliente) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <Link href="/mantenimientos" className="text-sm text-suave">
          ← Mantenimientos
        </Link>
        <p className="mt-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error ?? "Visita no encontrada."}
        </p>
      </main>
    );
  }

  const revisados = checklist.filter(
    (f) => f.respuesta && f.respuesta.estado !== "sin_revisar"
  ).length;
  const incidencias = checklist.filter(
    (f) => f.respuesta?.estado === "incidencia"
  ).length;
  // Sin explicar: el servidor las rechaza al firmar, así que se avisa antes
  // en vez de dejar que el técnico lo descubra con el cliente delante.
  const incidenciasSinExplicar = checklist.filter(
    (f) =>
      f.respuesta?.estado === "incidencia" && !f.respuesta.observacion?.trim()
  ).length;

  const completo =
    revisados === checklist.length &&
    checklist.length > 0 &&
    incidenciasSinExplicar === 0;

  const categoriasVisibles = CATEGORIAS.filter((c) =>
    checklist.some((f) => f.item.categoria === c)
  );

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <Link href="/mantenimientos" className="text-sm text-suave">
        ← Mantenimientos
      </Link>

      <div className="mt-2 mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            <Link href={`/clientes/${cliente.id}`} className="hover:underline">
              {cliente.nombre}
            </Link>
          </h1>
          <p className="mt-0.5 text-sm text-suave">
            Visita {NOMBRE_TIPO_VISITA[visita.tipo].toLowerCase()} · prevista{" "}
            {fecha(visita.fechaPrevista)}
            {!puedeAsignar &&
              (tecnico ? ` · ${tecnico.nombre}` : " · sin técnico asignado")}
          </p>
        </div>
        {visita.firmado && (
          <span className="shrink-0 rounded-full bg-acento-suave px-2 py-0.5 text-xs text-acento-contraste">
            Firmada {fecha(visita.fechaEjecucion)}
          </span>
        )}
      </div>

      {/* Los datos que el técnico necesita en la puerta, sin abrir otra
          pantalla: dónde es, qué CUPS y qué equipos hay. */}
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-borde bg-superficie p-4 text-xs sm:grid-cols-4">
        <div className="col-span-2">
          <dt className="text-tenue">Dirección</dt>
          <dd className="text-texto">
            {[
              cliente.direccion,
              [cliente.codigoPostal, cliente.poblacion]
                .filter(Boolean)
                .join(" "),
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-tenue">Isla</dt>
          <dd className="text-texto">{cliente.isla || "—"}</dd>
        </div>
        <div>
          <dt className="text-tenue">Inversor</dt>
          <dd className="text-texto">{cliente.marcaInversor || "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-tenue">CUPS</dt>
          <dd className="font-mono text-texto">{cliente.cups || "—"}</dd>
        </div>
        <div>
          <dt className="text-tenue">Batería</dt>
          <dd className="text-texto">{cliente.tieneBateria ? "Sí" : "No"}</dd>
        </div>
      </dl>

      {puedeAsignar && !visita.firmado ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-sm text-suave" htmlFor="tecnico">
            Técnico asignado
          </label>
          <select
            id="tecnico"
            value={tecnico?.id ?? ""}
            disabled={asignando}
            onChange={(e) => asignarTecnico(e.target.value)}
            className="rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none disabled:opacity-50"
          >
            <option value="">— Sin asignar —</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.isla ? ` · ${t.isla}` : ""}
              </option>
            ))}
          </select>
          {tecnicos.length === 0 && (
            <span className="text-xs text-aviso-contraste">
              No hay técnicos activos. Créalos en Usuarios.
            </span>
          )}
          {!tecnico && tecnicos.length > 0 && (
            <span className="text-xs text-aviso-contraste">
              Sin asignar: nadie la verá en su lista.
            </span>
          )}
        </div>
      ) : (
        puedeAsignar && (
          <p className="mb-4 text-sm text-suave">
            Técnico: {tecnico?.nombre ?? "sin asignar"}
          </p>
        )
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-suave">
          {revisados} de {checklist.length} puntos revisados
        </span>
        {incidencias > 0 && (
          <span className="rounded-full bg-peligro-suave px-2 py-0.5 text-xs text-peligro-contraste">
            {incidencias} incidencia{incidencias === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {categoriasVisibles.map((categoria) => (
        <section key={categoria} className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
            {NOMBRE_CATEGORIA[categoria]}
          </h2>

          <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
            {checklist
              .filter((f) => f.item.categoria === categoria)
              .map((fila) => {
                const estado = fila.respuesta?.estado ?? "sin_revisar";
                return (
                  <div key={fila.item.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-texto">
                        {fila.item.nombre}
                        <span className="ml-2 text-xs text-tenue">
                          {fila.item.periodicidadMeses} meses
                        </span>
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ESTADOS_PUNTO.filter((e) => e !== "sin_revisar").map(
                        (opcion) => (
                          <button
                            key={opcion}
                            type="button"
                            disabled={visita.firmado}
                            onClick={() =>
                              guardarPunto(fila, { estado: opcion })
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs disabled:opacity-60 ${
                              estado === opcion
                                ? ESTILO_ESTADO[opcion]
                                : "border-borde text-suave hover:border-borde-fuerte"
                            }`}
                          >
                            {NOMBRE_ESTADO[opcion]}
                          </button>
                        )
                      )}
                    </div>

                    {(estado === "incidencia" ||
                      fila.respuesta?.observacion) && (
                      <>
                        <textarea
                          rows={2}
                          disabled={visita.firmado}
                          defaultValue={fila.respuesta?.observacion ?? ""}
                          placeholder={
                            estado === "incidencia"
                              ? "Qué has encontrado"
                              : "Observación"
                          }
                          onBlur={(e) =>
                            guardarPunto(fila, {
                              observacion: e.target.value || null,
                            })
                          }
                          className="mt-2 w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
                        />
                        {estado === "incidencia" &&
                          !fila.respuesta?.observacion?.trim() && (
                            <p className="mt-1 text-xs text-aviso-contraste">
                              Explica la incidencia: sin esto no se puede
                              firmar la visita.
                            </p>
                          )}
                      </>
                    )}

                    <FotosPunto
                      mantenimientoId={id}
                      itemId={fila.item.id}
                      fotos={fila.fotos}
                      bloqueado={visita.firmado}
                      onCambio={cargar}
                    />
                  </div>
                );
              })}
          </div>

          {/* Observación del bloque entero: lo que se dice de "toda la
              estructura" no tiene que repetirse en sus cinco puntos. */}
          <textarea
            rows={2}
            disabled={visita.firmado}
            defaultValue={obsBloque[categoria] ?? ""}
            placeholder={`Observación general de ${NOMBRE_CATEGORIA[categoria].toLowerCase()}`}
            onBlur={(e) => guardarObservacionBloque(categoria, e.target.value)}
            className="mt-2 w-full rounded border border-borde bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
          />
        </section>
      ))}

      {visita.firmado ? (
        <div className="rounded-lg border border-borde bg-superficie p-5 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
            Conformidad
          </h2>
          <p className="text-suave">
            Firmada el {fecha(visita.fechaEjecucion)} por{" "}
            {visita.firmanteTecnicoNombre} (SR Energía) y{" "}
            {visita.firmanteClienteNombre} (cliente).
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-borde bg-superficie p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-tenue">
            Cerrar y firmar
          </h2>
          <p className="mb-4 text-xs text-tenue">
            Una vez firmada, la visita no se puede modificar.
          </p>

          {!completo && (
            <p className="mb-4 rounded-md border border-borde bg-superficie-alt p-3 text-sm text-suave">
              {revisados < checklist.length
                ? `Faltan ${checklist.length - revisados} punto(s) por revisar antes de poder firmar.`
                : `Hay ${incidenciasSinExplicar} incidencia(s) sin explicar. Añade la observación antes de firmar.`}
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-tenue">Técnico</p>
              <input
                placeholder="Nombre del técnico"
                value={datosFirma.tecnicoNombre}
                onChange={(e) =>
                  setDatosFirma({ ...datosFirma, tecnicoNombre: e.target.value })
                }
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
              <input
                placeholder="DNI del técnico"
                value={datosFirma.tecnicoDocumento}
                onChange={(e) =>
                  setDatosFirma({
                    ...datosFirma,
                    tecnicoDocumento: e.target.value.toUpperCase(),
                  })
                }
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
              <Firma
                etiqueta="Por SR Energía"
                valor={firmaTecnico}
                onChange={setFirmaTecnico}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-tenue">
                Cliente — cámbialo si firma otra persona
              </p>
              <input
                placeholder="Nombre de quien firma"
                value={datosFirma.clienteNombre}
                onChange={(e) =>
                  setDatosFirma({ ...datosFirma, clienteNombre: e.target.value })
                }
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
              <input
                placeholder="Documento de quien firma"
                value={datosFirma.clienteDocumento}
                onChange={(e) =>
                  setDatosFirma({
                    ...datosFirma,
                    clienteDocumento: e.target.value.toUpperCase(),
                  })
                }
                className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
              />
              <Firma
                etiqueta="Por el cliente"
                valor={firmaCliente}
                onChange={setFirmaCliente}
              />
            </div>
          </div>

          <button
            onClick={firmar}
            disabled={!completo || firmando}
            className="mt-4 rounded bg-acento px-4 py-2 text-sm text-acento-encima hover:bg-acento-hover disabled:opacity-50"
          >
            {firmando ? "Firmando…" : "Firmar y cerrar visita"}
          </button>
        </div>
      )}
    </main>
  );
}
