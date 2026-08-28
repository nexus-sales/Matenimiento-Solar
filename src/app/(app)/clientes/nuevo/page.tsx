"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { leerErrorApi } from "@/lib/errores-api";
import {
  FormularioCliente,
  cuerpoCliente,
  formularioVacio,
} from "../formulario-cliente";

export default function NuevoClientePage() {
  const router = useRouter();
  const [form, setForm] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoCliente(form)),
    });

    if (!res.ok) {
      setGuardando(false);
      setError(await leerErrorApi(res, "No se pudo crear el cliente."));
      return;
    }

    // Se entra directamente en la ficha recién creada: es donde el
    // administrador va a seguir trabajando (revisar, programar la visita).
    const creado = await res.json();
    router.push(`/clientes/${creado.id}`);
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/clientes" className="text-sm text-suave">
        ← Clientes
      </Link>
      <h1 className="mb-5 mt-2 text-xl font-semibold">Nuevo cliente</h1>

      <FormularioCliente
        valor={form}
        onChange={setForm}
        onSubmit={crear}
        onCancelar={() => router.push("/clientes")}
        guardando={guardando}
        error={error}
        etiquetaGuardar="Crear cliente"
      />
    </main>
  );
}
