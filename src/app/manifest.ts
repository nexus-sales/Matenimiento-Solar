import type { MetadataRoute } from "next";

/**
 * Manifiesto de aplicación instalable.
 *
 * El destino real es el móvil del técnico: instalada en la pantalla de
 * inicio se abre sin barra del navegador, lo que devuelve unos 100 píxeles
 * de alto — que en un checklist de 24 puntos con fotos se notan.
 *
 * `start_url` apunta a mantenimientos y no a la raíz: quien instala esto en
 * el móvil es el técnico, y lo primero que necesita es su lista de visitas.
 * La oficina entra desde el ordenador y no pasa por aquí.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SR Energía — Mantenimiento",
    short_name: "Mantenimiento",
    description:
      "Visitas de mantenimiento de instalaciones fotovoltaicas: checklist, fotos y firma en campo.",
    start_url: "/mantenimientos",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8f5",
    theme_color: "#6d7c0f",
    lang: "es",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      {
        // Android recorta el icono con la forma del sistema. El maskable
        // lleva más margen para que el recorte no se coma el motivo.
        src: "/icono-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
