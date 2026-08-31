"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leerErrorApi } from "@/lib/errores-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setEnviando(false);

    if (!res.ok) {
      setError(await leerErrorApi(res, "No se pudo iniciar sesión."));
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-superficie-alt p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-borde bg-superficie p-6 space-y-4"
      >
        <h1 className="text-lg font-semibold">Iniciar sesión</h1>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-borde-fuerte p-2 text-sm focus:border-acento focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-borde-fuerte p-2 text-sm focus:border-acento focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-peligro">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-acento text-acento-encima rounded hover:bg-acento-hover p-2 text-sm disabled:opacity-50"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {/* Los enlaces legales van en el login porque es la unica pantalla que
          se ve sin sesion, y porque el aviso legal exige que sean accesibles. */}
      <nav className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-tenue">
        <a href="/legal/privacidad" className="hover:underline">
          Privacidad
        </a>
        <a href="/legal/cookies" className="hover:underline">
          Cookies
        </a>
        <a href="/legal/aviso-legal" className="hover:underline">
          Aviso legal
        </a>
      </nav>
    </main>
  );
}
