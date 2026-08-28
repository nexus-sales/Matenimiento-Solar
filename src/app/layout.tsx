import type { Metadata } from "next";
import "./globals.css";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata: Metadata = {
  title: "SR Energía — Mantenimiento",
  description: "Gestión de mantenimiento de instalaciones fotovoltaicas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script de abajo escribe data-theme en el
    // <html> antes de que React hidrate, así que el atributo que ve el
    // cliente no coincide con el que renderizó el servidor. Es intencionado
    // y está acotado a este elemento.
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
