import Link from "next/link";

/**
 * Las páginas legales son PÚBLICAS, sin sesión, a propósito.
 *
 * Quien tiene derecho a leer la información del artículo 13 es el cliente
 * cuyos datos se tratan, y esa persona no tiene cuenta en la aplicación:
 * firma una vez en su casa, desde el móvil del técnico. Si hiciera falta
 * iniciar sesión para leer la política de privacidad, la información no
 * estaría disponible para quien más la necesita.
 *
 * Ver también la lista de rutas públicas de src/proxy.ts.
 */

const PAGINAS = [
  { href: "/legal/privacidad", etiqueta: "Privacidad" },
  { href: "/legal/cookies", etiqueta: "Cookies" },
  { href: "/legal/aviso-legal", etiqueta: "Aviso legal" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-fondo">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="block h-5 w-1.5 rounded-full bg-marca"
            />
            <span className="text-sm font-semibold">SR Energía</span>
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-suave">
            {PAGINAS.map((p) => (
              <Link key={p.href} href={p.href} className="hover:text-texto">
                {p.etiqueta}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* prose-legal: el texto legal se lee seguido, no se escanea. Medida de
          línea corta y espacio generoso entre párrafos. */}
      <main className="mx-auto max-w-2xl p-4 py-8 sm:p-8 sm:py-12 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mb-1.5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>

      <footer className="mx-auto max-w-2xl px-4 pb-12 sm:px-8">
        <p className="border-t border-borde pt-4 text-xs text-tenue">
          Última actualización: 30 de agosto de 2026.
        </p>
      </footer>
    </div>
  );
}
