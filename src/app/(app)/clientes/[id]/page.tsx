"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { leerErrorApi } from "@/lib/errores-api";
import {
  FormularioCliente,
  cuerpoCliente,
  formularioDesdeCliente,
  type ClienteFormulario,
} from "../formulario-cliente";

type Cliente = {
  id: string;
  fechaAlta: string | null;
  nombre: string;
  documento: string;
  direccion: string | null;
  poblacion: string | null;
  codigoPostal: string | null;
  isla: string | null;
  provincia: string | null;
  email: string | null;
  telefono: string | null;
  cups: string | null;
  potenciaContratada: string | null;
  potenciaNominal: string | null;
  marcaInversor: string | null;
  numeroInversor: string | null;
  comercializadora: string | null;
  tieneBateria: boolean;
  tieneMantenimiento: boolean;
  comentarios: string | null;
};

type Visita = {
  id: string;
  fechaPrevista: string;
  fechaEjecucion: string | null;
  contactado: boolean;
  firmado: boolean;
  anulada: boolean;
  comentariosGenerales: string | null;
  tecnicoNombre: string | null;
};

function fecha(iso: string | null) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="text-sm text-texto">{valor}</dd>
    </div>
  );
}

function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-borde pt-4 first:border-0 first:pt-0">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-tenue">
        {titulo}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {children}
      </dl>
    </section>
  );
}

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [form, setForm] = useState<ClienteFormulario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch(`/api/clientes/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCliente(data.cliente);
      setVisitas(data.mantenimientos);
      setError(null);
    } else {
      setError(
        await leerErrorApi(res, "No se pudo cargar la ficha del cliente.")
      );
    }
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // Carga inicial de datos al montar: sincroniza con el servidor,
    // no con estado de React — patrón habitual y correcto pese al aviso
    // de la regla react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  function empezarEdicion() {
    if (!cliente) return;
    setForm(formularioDesdeCliente(cliente));
    setError(null);
    setEditando(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setGuardando(true);

    const res = await fetch(`/api/clientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoCliente(form)),
    });

    setGuardando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo guardar."));
      return;
    }

    setEditando(false);
    cargar();
  }

  async function borrar() {
    if (
      !confirm(
        "¿Borrar este cliente? Se borrará también su histórico de mantenimientos. Esta acción no se puede deshacer."
      )
    )
      return;

    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/clientes");
    } else {
      setError(await leerErrorApi(res, "No se pudo borrar."));
    }
  }

  if (cargando) return <p className="p-8 text-sm text-suave">Cargando…</p>;

  if (!cliente) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <Link href="/clientes" className="text-sm text-suave">
          ← Clientes
        </Link>
        <p className="mt-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error ?? "Cliente no encontrado."}
        </p>
      </main>
    );
  }

  if (editando && form) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <Link href="/clientes" className="text-sm text-suave">
          ← Clientes
        </Link>
        <h1 className="mb-5 mt-2 text-xl font-semibold">
          Editar {cliente.nombre}
        </h1>
        <FormularioCliente
          valor={form}
          onChange={setForm}
          onSubmit={guardar}
          onCancelar={() => setEditando(false)}
          guardando={guardando}
          error={error}
          etiquetaGuardar="Guardar cambios"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <Link href="/clientes" className="text-sm text-suave">
        ← Clientes
      </Link>

      <div className="mb-1 mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{cliente.nombre}</h1>
          <p className="mt-0.5 text-sm text-suave">
            {cliente.documento}
            {cliente.fechaAlta ? ` · alta ${fecha(cliente.fechaAlta)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={empezarEdicion}
            className="rounded border border-borde-fuerte px-3 py-1.5 text-sm hover:bg-superficie-alt"
          >
            Editar
          </button>
          <button
            onClick={borrar}
            className="rounded border border-peligro-borde px-3 py-1.5 text-sm text-peligro hover:bg-peligro-suave"
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        <span
          className={
            cliente.tieneMantenimiento
              ? "rounded-full bg-acento-suave px-2 py-0.5 text-xs text-acento-contraste"
              : "rounded-full bg-superficie-fuerte px-2 py-0.5 text-xs text-suave"
          }
        >
          {cliente.tieneMantenimiento
            ? "Con mantenimiento"
            : "Sin mantenimiento"}
        </span>
        {cliente.tieneBateria && (
          <span className="rounded-full bg-info-suave px-2 py-0.5 text-xs text-info-contraste">
            Con batería
          </span>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      <div className="space-y-5 rounded-lg border border-borde bg-superficie p-5">
        <Bloque titulo="Contacto">
          <Dato etiqueta="Teléfono" valor={cliente.telefono || "—"} />
          <Dato etiqueta="Email" valor={cliente.email || "—"} />
          <Dato etiqueta="Isla" valor={cliente.isla || "—"} />
          <Dato etiqueta="Provincia" valor={cliente.provincia || "—"} />
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-tenue">Dirección</dt>
            <dd className="text-sm text-texto">
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
        </Bloque>

        <Bloque titulo="Instalación">
          <div className="col-span-2">
            <dt className="text-xs text-tenue">CUPS</dt>
            <dd className="font-mono text-sm text-texto">
              {cliente.cups || "—"}
            </dd>
          </div>
          <Dato
            etiqueta="P. contratada"
            valor={
              cliente.potenciaContratada
                ? `${cliente.potenciaContratada} kW`
                : "—"
            }
          />
          <Dato
            etiqueta="P. nominal"
            valor={
              cliente.potenciaNominal ? `${cliente.potenciaNominal} kW` : "—"
            }
          />
          <Dato etiqueta="Marca inversor" valor={cliente.marcaInversor || "—"} />
          <Dato etiqueta="Nº inversor" valor={cliente.numeroInversor || "—"} />
          <Dato
            etiqueta="Comercializadora"
            valor={cliente.comercializadora || "—"}
          />
          <Dato etiqueta="Batería" valor={cliente.tieneBateria ? "Sí" : "No"} />
        </Bloque>

        {cliente.comentarios && (
          <section className="border-t border-borde pt-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
              Comentarios
            </h2>
            <p className="whitespace-pre-wrap text-sm text-medio">
              {cliente.comentarios}
            </p>
          </section>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase text-suave">
        Histórico de mantenimientos
      </h2>

      {visitas.length === 0 ? (
        <p className="text-sm text-suave">
          {cliente.tieneMantenimiento
            ? "Todavía no hay visitas registradas para este cliente."
            : "Este cliente no tiene mantenimiento contratado."}
        </p>
      ) : (
        <div className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-superficie">
          {visitas.map((v) => (
            <Link
              key={v.id}
              href={`/mantenimientos/${v.id}`}
              className="block p-3 hover:bg-superficie-alt"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-texto">
                  Cita {fecha(v.fechaPrevista)}
                </p>
                <span
                  className={
                    v.anulada
                      ? "shrink-0 rounded-full bg-peligro-suave px-2 py-0.5 text-xs text-peligro-contraste"
                      : v.fechaEjecucion
                        ? "shrink-0 rounded-full bg-acento-suave px-2 py-0.5 text-xs text-acento-contraste"
                        : "shrink-0 rounded-full bg-superficie-fuerte px-2 py-0.5 text-xs text-suave"
                  }
                >
                  {v.anulada
                    ? "Anulada"
                    : v.fechaEjecucion
                      ? `Ejecutada ${fecha(v.fechaEjecucion)}`
                      : "Pendiente"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-suave">
                {v.tecnicoNombre ?? "Sin técnico asignado"}
                {v.firmado ? " · Firmada" : ""}
              </p>
              {v.firmado && (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(ev) => {
                    // El histórico es una lista de enlaces a la visita; el
                    // acta es un destino distinto, así que se corta la
                    // navegación del enlace que lo envuelve.
                    ev.preventDefault();
                    ev.stopPropagation();
                    window.open(`/api/mantenimientos/${v.id}/informe`, "_blank");
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      ev.stopPropagation();
                      window.open(`/api/mantenimientos/${v.id}/informe`, "_blank");
                    }
                  }}
                  className="mt-1 inline-block cursor-pointer text-xs text-acento-contraste underline-offset-2 hover:underline"
                >
                  Descargar acta en PDF
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
