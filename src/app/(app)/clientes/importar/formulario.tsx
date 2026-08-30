"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { leerErrorApi } from "@/lib/errores-api";

type Fila = {
  fila: number;
  nombre: string;
  documento: string;
  estado: "nuevo" | "existente" | "error";
  errores: string[];
};

type Analisis = {
  columnasReconocidas: string[];
  columnasIgnoradas: string[];
  filas: Fila[];
  duplicadosEnArchivo: string[];
  totales: {
    leidas: number;
    nuevas: number;
    existentes: number;
    errores: number;
  };
  importado?: boolean;
  insertados?: number;
  actualizados?: number;
};

const CLASE_ESTADO: Record<Fila["estado"], string> = {
  nuevo: "bg-acento-suave text-acento-contraste",
  existente: "bg-info-suave text-info-contraste",
  error: "bg-peligro-suave text-peligro-contraste",
};

const NOMBRE_ESTADO: Record<Fila["estado"], string> = {
  nuevo: "Nuevo",
  existente: "Ya existe",
  error: "Error",
};

export default function ImportarClientesPage() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [siExiste, setSiExiste] = useState<"saltar" | "actualizar">("saltar");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soloProblemas, setSoloProblemas] = useState(false);

  async function enviar(confirmar: boolean) {
    if (!archivo) return;
    setTrabajando(true);
    setError(null);

    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);
    cuerpo.append("siExiste", siExiste);
    if (confirmar) cuerpo.append("confirmar", "si");

    const res = await fetch("/api/clientes/importar", {
      method: "POST",
      body: cuerpo,
    });

    setTrabajando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo procesar el archivo."));
      return;
    }

    setAnalisis(await res.json());
  }

  const t = analisis?.totales;
  const hayErrores = (t?.errores ?? 0) > 0;
  const importado = analisis?.importado;

  const visibles = soloProblemas
    ? (analisis?.filas ?? []).filter((f) => f.estado !== "nuevo")
    : (analisis?.filas ?? []);

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <Link href="/clientes" className="text-sm text-suave">
        ← Clientes
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-semibold">Importar clientes</h1>
      <p className="mb-6 text-sm text-suave">
        Desde un Excel. Se analiza primero y no se escribe nada hasta que lo
        confirmes.
      </p>

      {error && (
        <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
          {error}
        </p>
      )}

      {!importado && (
        <div className="mb-6 rounded-lg border border-borde bg-superficie p-5">
          <input
            ref={entrada}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setAnalisis(null);
              setError(null);
            }}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="rounded border border-borde-fuerte px-3 py-2 text-sm hover:bg-superficie-alt"
            >
              Elegir archivo
            </button>
            <span className="text-sm text-suave">
              {archivo?.name ?? "Ningún archivo elegido"}
            </span>
          </div>

          <p className="mt-3 text-xs text-tenue">
            Se reconocen las columnas por su nombre, en cualquier orden. Como
            mínimo hacen falta el nombre y el documento. Las columnas de cita y
            ejecución pertenecen a una visita y se ignoran.
          </p>

          {archivo && !analisis && (
            <button
              onClick={() => enviar(false)}
              disabled={trabajando}
              className="mt-4 rounded bg-acento px-4 py-2 text-sm text-acento-encima hover:bg-acento-hover disabled:opacity-50"
            >
              {trabajando ? "Analizando…" : "Analizar archivo"}
            </button>
          )}
        </div>
      )}

      {analisis && (
        <>
          {importado ? (
            <div className="mb-6 rounded-lg border border-acento bg-acento-suave p-5">
              <p className="text-sm font-semibold text-acento-contraste">
                Importación terminada
              </p>
              <p className="mt-1 text-sm text-acento-contraste">
                {analisis.insertados} cliente(s) creado(s)
                {analisis.actualizados ? `, ${analisis.actualizados} actualizado(s)` : ""}
                .
              </p>
              <button
                onClick={() => router.push("/clientes")}
                className="mt-3 rounded bg-acento px-3 py-1.5 text-sm text-acento-encima hover:bg-acento-hover"
              >
                Ver los clientes
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Filas leídas", t?.leidas ?? 0, ""],
                  ["Se crearán", t?.nuevas ?? 0, "text-acento-contraste"],
                  ["Ya existen", t?.existentes ?? 0, "text-info-contraste"],
                  ["Con error", t?.errores ?? 0, "text-peligro-contraste"],
                ].map(([etiqueta, valor, color]) => (
                  <div
                    key={String(etiqueta)}
                    className="rounded-lg border border-borde bg-superficie p-3"
                  >
                    <p className="text-xs text-tenue">{etiqueta}</p>
                    <p className={`text-2xl font-semibold ${color}`}>{valor}</p>
                  </div>
                ))}
              </div>

              {analisis.columnasIgnoradas.length > 0 && (
                <p className="mb-4 text-xs text-tenue">
                  Columnas ignoradas: {analisis.columnasIgnoradas.join(", ")}
                </p>
              )}

              {analisis.duplicadosEnArchivo.length > 0 && (
                <p className="mb-4 rounded-md border border-peligro-borde bg-peligro-suave p-3 text-sm text-peligro-contraste">
                  El archivo repite estos documentos:{" "}
                  {analisis.duplicadosEnArchivo.join(", ")}. Corrígelo antes de
                  importar — no se puede saber cuál de las filas vale.
                </p>
              )}

              {(t?.existentes ?? 0) > 0 && (
                <div className="mb-4 rounded-lg border border-borde bg-superficie p-4">
                  <p className="mb-2 text-sm font-medium">
                    Hay {t?.existentes} cliente(s) que ya están en la base
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="siExiste"
                        checked={siExiste === "saltar"}
                        onChange={() => setSiExiste("saltar")}
                        className="mt-1"
                      />
                      <span>
                        <strong>Saltarlos</strong> — se dejan como están. Lo
                        prudente si no sabes cuál de los dos datos es el bueno.
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="siExiste"
                        checked={siExiste === "actualizar"}
                        onChange={() => setSiExiste("actualizar")}
                        className="mt-1"
                      />
                      <span>
                        <strong>Actualizarlos</strong> — el archivo pisa lo que
                        haya en la ficha. Los campos vacíos del Excel borran lo
                        que hubiera.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {hayErrores && (
                <p className="mb-4 rounded-md border border-borde bg-superficie-alt p-3 text-sm text-suave">
                  Las {t?.errores} filas con error <strong>no se importan</strong>.
                  El resto sí. Puedes corregirlas en el Excel y volver a subirlo:
                  las que ya estén no se duplican.
                </p>
              )}

              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-suave">
                  Fila a fila
                </h2>
                <label className="flex items-center gap-2 text-xs text-suave">
                  <input
                    type="checkbox"
                    checked={soloProblemas}
                    onChange={(e) => setSoloProblemas(e.target.checked)}
                  />
                  Ver solo lo que necesita atención
                </label>
              </div>

              <div className="mb-6 overflow-x-auto rounded-lg border border-borde bg-superficie">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                      <th className="p-2 font-medium">Fila</th>
                      <th className="p-2 font-medium">Nombre</th>
                      <th className="p-2 font-medium">Documento</th>
                      <th className="p-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((f) => (
                      <tr key={f.fila} className="border-b border-borde last:border-0">
                        <td className="p-2 font-mono text-xs text-tenue">
                          {f.fila}
                        </td>
                        <td className="p-2">{f.nombre || "—"}</td>
                        <td className="p-2 font-mono text-xs">
                          {f.documento || "—"}
                        </td>
                        <td className="p-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${CLASE_ESTADO[f.estado]}`}
                          >
                            {NOMBRE_ESTADO[f.estado]}
                          </span>
                          {f.errores.length > 0 && (
                            <p className="mt-1 text-xs text-peligro-contraste">
                              {f.errores.join(" · ")}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visibles.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-sm text-suave">
                          Ninguna fila necesita atención.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => enviar(true)}
                  disabled={
                    trabajando ||
                    analisis.duplicadosEnArchivo.length > 0 ||
                    (t?.nuevas ?? 0) + (siExiste === "actualizar" ? (t?.existentes ?? 0) : 0) === 0
                  }
                  className="rounded bg-acento px-4 py-2 text-sm text-acento-encima hover:bg-acento-hover disabled:opacity-50"
                >
                  {trabajando
                    ? "Importando…"
                    : `Importar ${(t?.nuevas ?? 0) + (siExiste === "actualizar" ? (t?.existentes ?? 0) : 0)} cliente(s)`}
                </button>
                <button
                  onClick={() => {
                    setAnalisis(null);
                    setArchivo(null);
                  }}
                  className="rounded border border-borde-fuerte px-4 py-2 text-sm hover:bg-superficie-alt"
                >
                  Empezar de nuevo
                </button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
