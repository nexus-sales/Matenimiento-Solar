import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SCRIPT_TEMA } from "@/lib/tema";
import RegistrarSW from "./registrar-sw";

export const metadata: Metadata = {
  title: "SR Energía — Mantenimiento",
  description: "Gestión de mantenimiento de instalaciones fotovoltaicas",
  // iOS no lee el manifiesto para el icono de la pantalla de inicio.
  appleWebApp: {
    capable: true,
    title: "Mantenimiento",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin tope de zoom: el técnico puede necesitar ampliar una foto o leer un
  // CUPS a contraluz en una cubierta. Bloquearlo es una molestia gratuita y
  // un problema de accesibilidad.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#101310" },
  ],
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
      <body className="h-full font-sans">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
