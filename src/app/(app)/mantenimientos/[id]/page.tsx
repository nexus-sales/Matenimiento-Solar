"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";
import { NOMBRE_TIPO_VISITA, type EstadoPunto } from "@/lib/checklist";
import {
  bloquesDe,
  campoPendiente,
  NOMBRE_PLANTILLA,
  type Plantilla,
} from "@/lib/plantillas";
import { Firma } from "./panel-firma";
import { CampoRespuesta, campoRespondido, type FilaCampo } from "./campo";

// La forma de un campo y su respuesta vive en ./campo, que es quien los
// pinta. Aquí solo se manejan como filas.
type Fila = FilaCampo;

type Visita = {
  id: string;
  plantilla: Plantilla;
  tipo: "semestral" | "anual";
  fechaPrevista: string;
  fechaEjecucion: string | null;
  contactado: boolean;
  fechaContacto: string | null;
  viaWhatsapp: boolean;
  firmado: boolean;
  comentariosGenerales: string | null;
  equiposReemplazados: string | null;
  firmanteClienteNombre: string | null;
  firmanteClienteDocumento: string | null;
  firmanteTecnicoNombre: string | null;
  firmanteTecnicoDocumento: string | null;
  firmaTecnico: string | null;
  firmaCliente: string | null;
  numeroFactura: string | null;
  anulada: boolean;
  motivoAnulacion: string | null;
  anuladaEn: string | null;
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

/**
 * Hoy en formato ISO, en hora LOCAL.
 *
 * `toISOString()` convierte a UTC. Canarias va por delante de UTC en verano,
 * así que entre medianoche y la una de la madrugada UTC sigue en el día
 * anterior y la fecha de aviso se guardaría con un día de menos. Es el mismo
 * motivo por el que el resto de la app construye las fechas a mano.
 */
function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function fecha(iso: string | null) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}


export default function VisitaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

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
  const [factura, setFactura] = useState("");
  const [guardandoFactura, setGuardandoFactura] = useState(false);
  const [guardandoAviso, setGuardandoAviso] = useState(false);
  const [puedeAnular, setPuedeAnular] = useState(false);
  const [mostrarAnular, setMostrarAnular] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [rehacer, setRehacer] = useState(true);
  const [anulando, setAnulando] = useState(false);
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
      setPuedeAnular(Boolean(d.puedeAnular));

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
    cambios: {
      estado?: EstadoPunto;
      valor?: string | null;
      observacion?: string | null;
    }
  ) {
    const estado = cambios.estado ?? fila.respuesta?.estado ?? "sin_revisar";
    const valor =
      cambios.valor !== undefined ? cambios.valor : (fila.respuesta?.valor ?? null);
    const observacion =
      cambios.observacion !== undefined
        ? cambios.observacion
        : (fila.respuesta?.observacion ?? null);

    setChecklist((prev) =>
      prev.map((f) =>
        f.item.id === fila.item.id
          ? {
              ...f,
              respuesta: {
                id: f.respuesta?.id ?? "",
                estado,
                valor,
                observacion,
              },
            }
          : f
      )
    );

    // Se manda solo lo que ha cambiado, no el estado entero de la fila: el
    // servidor distingue "no viene" de "viene vacío", y mandarlo todo haría
    // que guardar una observación pisara el valor con lo que tuviera la
    // pantalla, que puede ir por detrás.
    const res = await fetch(`/api/mantenimientos/${id}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: fila.item.id, ...cambios }),
    });

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar el campo."));
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

  /**
   * El número de factura se puede poner DESPUÉS de firmar: lo asigna la
   * oficina al facturar, y no forma parte de lo que firmó el cliente. Al
   * cambiarlo, el servidor invalida el acta guardada para que se regenere.
   */
  async function guardarFactura() {
    setGuardandoFactura(true);
    setError(null);

    const res = await fetch(`/api/mantenimientos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroFactura: factura.trim() || null }),
    });

    setGuardandoFactura(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar el nº de factura."));
      return;
    }
    cargar();
  }

  /**
   * Deja constancia de que se avisó al cliente.
   *
   * Sin esto, a la semana siguiente nadie sabe a quién se llamó ya: o se
   * llama dos veces o no se llama, y el técnico se planta en una casa donde
   * no le esperan — a veces después de coger un barco.
   */
  async function guardarAviso(cambios: {
    contactado?: boolean;
    fechaContacto?: string | null;
    viaWhatsapp?: boolean;
  }) {
    setGuardandoAviso(true);
    setError(null);

    const res = await fetch(`/api/mantenimientos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });

    setGuardandoAviso(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar el aviso."));
      return;
    }
    cargar();
  }

  /**
   * Anular no borra ni edita: marca la visita y programa otra. El contenido
   * del acta firmada no cambia nunca — solo pasa a llevar un sello.
   */
  async function anular() {
    setAnulando(true);
    setError(null);

    const res = await fetch(`/api/mantenimientos/${id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo, rehacer }),
    });

    setAnulando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo anular la visita."));
      return;
    }

    const { nueva } = await res.json();
    // Si se programó la sustituta, se va directo a ella: es donde hay que
    // seguir trabajando.
    if (nueva?.id) router.push(`/mantenimientos/${nueva.id}`);
    else cargar();
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

  // Dos cuentas distintas, que antes se mostraban como una sola.
  //
  // RESPONDIDOS es cuántos campos tienen respuesta de verdad. Depende del
  // tipo: uno de foto se responde subiendo una foto, no marcando un estado.
  //
  // BLOQUEAN es cuántos impiden firmar. En el checklist de mantenimiento son
  // los mismos, porque todos sus puntos son obligatorios. En el acta no: solo
  // 25 de sus 56 campos bloquean, así que contar "lo que no bloquea" como
  // hecho mostraba un acta en blanco al 55 %.
  const respondidos = checklist.filter(campoRespondido).length;
  const bloquean = checklist.filter((f) =>
    campoPendiente(f.item, f.respuesta, f.fotos.length)
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
    bloquean === 0 && checklist.length > 0 && incidenciasSinExplicar === 0;

  const bloques = bloquesDe(
    visita.plantilla,
    checklist.map((f) => f.item.categoria)
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
            {/* El tipo semestral/anual solo significa algo en el checklist
                de mantenimiento: en una visita previa o un acta de obra no
                hay periodicidad que filtrar. */}
            {visita.plantilla === "mantenimiento"
              ? `Visita ${NOMBRE_TIPO_VISITA[visita.tipo].toLowerCase()}`
              : NOMBRE_PLANTILLA[visita.plantilla]}{" "}
            · prevista {fecha(visita.fechaPrevista)}
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
          {respondidos} de {checklist.length} campos respondidos
        </span>
        {bloquean > 0 && (
          <span className="text-aviso-contraste">
            {bloquean} obligatorio{bloquean === 1 ? "" : "s"} sin completar
          </span>
        )}
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

      {bloques.map((bloque) => (
        <section key={bloque.clave} className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
            {bloque.nombre}
          </h2>

          <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
            {checklist
              .filter((f) => f.item.categoria === bloque.clave)
              .map((fila) => (
                <CampoRespuesta
                  key={fila.item.id}
                  fila={fila}
                  intervencionId={id}
                  bloqueado={visita.firmado}
                  onGuardar={guardarPunto}
                  onCambioFotos={cargar}
                />
              ))}
          </div>

          {/* Observación del bloque entero: lo que se dice de "toda la
              estructura" no tiene que repetirse en sus cinco puntos. */}
          <textarea
            rows={2}
            disabled={visita.firmado}
            defaultValue={obsBloque[bloque.clave] ?? ""}
            placeholder={`Observación general de ${bloque.nombre.toLowerCase()}`}
            onBlur={(e) => guardarObservacionBloque(bloque.clave, e.target.value)}
            className="mt-2 w-full rounded border border-borde bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
          />
        </section>
      ))}

      {visita.anulada && (
        <div className="mb-5 rounded-lg border border-peligro-borde bg-peligro-suave p-4">
          <p className="text-sm font-semibold text-peligro-contraste">
            Acta anulada — sin validez
          </p>
          <p className="mt-1 text-sm text-peligro-contraste">
            Anulada el {fecha(visita.anuladaEn?.slice(0, 10) ?? null)}.
            {visita.motivoAnulacion ? ` ${visita.motivoAnulacion}` : ""}
          </p>
          <p className="mt-1 text-xs text-peligro-contraste">
            El acta se conserva con su sello: no se borra para no dejar un
            hueco sin explicación en el histórico del cliente.
          </p>
        </div>
      )}

      {/* Aviso al cliente. Solo antes de firmar: después ya no significa
          nada, porque la visita se hizo. Es trabajo de oficina. */}
      {puedeAsignar && !visita.firmado && (
        <div className="mb-5 rounded-lg border border-borde bg-superficie p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-tenue">
            Aviso al cliente
          </h2>
          <p className="mb-3 text-xs text-tenue">
            Para que no se le llame dos veces, y para que el técnico no se
            plante en una casa donde no le esperan.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={guardandoAviso}
              onClick={() =>
                guardarAviso(
                  visita.contactado
                    ? { contactado: false, fechaContacto: null }
                    : { contactado: true, fechaContacto: hoyISO() }
                )
              }
              className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
                visita.contactado
                  ? "border-acento bg-acento-suave text-acento-contraste"
                  : "border-borde text-suave hover:border-borde-fuerte"
              }`}
            >
              {visita.contactado ? "✓ Avisado" : "Marcar como avisado"}
            </button>

            {visita.contactado && (
              <>
                <input
                  type="date"
                  value={visita.fechaContacto ?? ""}
                  disabled={guardandoAviso}
                  onChange={(e) =>
                    guardarAviso({ fechaContacto: e.target.value || null })
                  }
                  className="rounded border border-borde-fuerte bg-superficie p-1.5 text-sm focus:border-acento focus:outline-none"
                />
                <label className="flex items-center gap-1.5 text-sm text-suave">
                  <input
                    type="checkbox"
                    checked={visita.viaWhatsapp}
                    disabled={guardandoAviso}
                    onChange={(e) =>
                      guardarAviso({ viaWhatsapp: e.target.checked })
                    }
                    className="accent-acento"
                  />
                  Por WhatsApp
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {puedeAsignar && (
        <div className="mb-5 rounded-lg border border-borde bg-superficie p-4">
          <label
            htmlFor="factura"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-tenue"
          >
            Nº de factura
          </label>
          <p className="mb-2 text-xs text-tenue">
            Se puede rellenar después de firmar. Aparece en el acta.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id="factura"
              value={factura}
              onChange={(e) => setFactura(e.target.value)}
              placeholder="F-2026-0142"
              className="min-w-0 flex-1 rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
            />
            <button
              onClick={guardarFactura}
              disabled={
                guardandoFactura || factura.trim() === (visita.numeroFactura ?? "")
              }
              className="rounded border border-borde-fuerte px-3 py-2 text-sm hover:bg-superficie-alt disabled:opacity-40"
            >
              {guardandoFactura ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {visita.firmado ? (
        <div className="rounded-lg border border-borde bg-superficie p-5 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
            Conformidad
          </h2>
          <p className="text-suave">
            Firmada el {fecha(visita.fechaEjecucion)}. No admite cambios.
          </p>

          {/* Se enseñan los trazos, no solo los nombres: es lo que uno
              espera comprobar de un acta, y prueba que se guardaron. El
              fondo es blanco fijo porque la firma se dibujó en negro. */}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                titulo: "Por SR Energía",
                firma: visita.firmaTecnico,
                nombre: visita.firmanteTecnicoNombre,
                documento: visita.firmanteTecnicoDocumento,
              },
              {
                titulo: "Por el cliente",
                firma: visita.firmaCliente,
                nombre: visita.firmanteClienteNombre,
                documento: visita.firmanteClienteDocumento,
              },
            ].map((f) => (
              <div key={f.titulo}>
                <p className="mb-1 text-xs text-tenue">{f.titulo}</p>
                {f.firma ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={f.firma}
                    alt={`Firma de ${f.nombre ?? "quien firmó"}`}
                    className="h-24 w-full rounded border border-borde bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded border border-borde bg-superficie-alt text-xs text-tenue">
                    Sin firma guardada
                  </div>
                )}
                <p className="mt-1 text-sm text-texto">{f.nombre || "—"}</p>
                <p className="text-xs text-suave">{f.documento || ""}</p>
              </div>
            ))}
          </div>

          {/* El acta se abre en otra pestaña en vez de descargarse a la
              fuerza: así se puede revisar antes de reenviarla al cliente. */}
          <a
            href={`/api/mantenimientos/${id}/informe`}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex items-center gap-2 rounded bg-acento px-3 py-2 text-sm text-acento-encima hover:bg-acento-hover"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-4 w-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5M12 15V3" />
            </svg>
            Descargar acta en PDF
          </a>

          {puedeAnular && !visita.anulada && (
            <div className="mt-5 border-t border-borde pt-4">
              {!mostrarAnular ? (
                <button
                  onClick={() => setMostrarAnular(true)}
                  className="text-xs text-suave underline-offset-2 hover:text-peligro hover:underline"
                >
                  Se firmó por error — anular esta visita
                </button>
              ) : (
                <div>
                  <p className="text-sm font-medium text-texto">
                    Anular la visita
                  </p>
                  <p className="mt-1 mb-2 text-xs text-suave">
                    No se borra ni se edita: queda marcada con el motivo, y su
                    acta pasa a llevar un sello de anulada. Si ya se la enviaste
                    al cliente, conviene avisarle.
                  </p>
                  <textarea
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo — quedará escrito en el histórico"
                    className="w-full rounded border border-borde-fuerte bg-superficie p-2 text-sm focus:border-acento focus:outline-none"
                  />
                  <label className="mt-2 flex items-center gap-2 text-sm text-medio">
                    <input
                      type="checkbox"
                      checked={rehacer}
                      onChange={(e) => setRehacer(e.target.checked)}
                    />
                    Programar una visita nueva para el mismo cliente
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={anular}
                      disabled={anulando || motivo.trim().length < 10}
                      className="rounded border border-peligro-borde px-3 py-1.5 text-sm text-peligro hover:bg-peligro-suave disabled:opacity-40"
                    >
                      {anulando ? "Anulando…" : "Anular"}
                    </button>
                    <button
                      onClick={() => setMostrarAnular(false)}
                      className="rounded border border-borde-fuerte px-3 py-1.5 text-sm hover:bg-superficie-alt"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
              {bloquean > 0
                ? `Faltan ${bloquean} campo(s) obligatorio(s) por completar antes de poder firmar.`
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
