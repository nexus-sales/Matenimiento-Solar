import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * En desarrollo, Next solo sirve sus recursos internos —los chunks de
   * JavaScript y el WebSocket de recarga en caliente— al origen con el que
   * arrancó, que por defecto es localhost. Desde cualquier otro devuelve 403
   * y el HMR no llega a conectar.
   *
   * Se autorizan aquí los orígenes desde los que se abre la app además de
   * localhost:
   *   10.8.*.*     la VPN, para entrar desde otro equipo
   *   192.168.*.*  la red local, para probar en el móvil — que es donde de
   *                verdad se usa la app: el técnico firma con el dedo
   *
   * El comodín cubre UN segmento entre puntos. No se admite notación de red
   * (`192.168.0.0/16` no coincidiría nunca): el emparejamiento es por
   * segmentos, igual que en los dominios.
   *
   * Solo afecta a `next dev`; en producción esta opción se ignora. Hay que
   * reiniciar el servidor para que un cambio aquí surta efecto.
   */
  allowedDevOrigins: ["10.8.*.*", "192.168.*.*"],

  /**
   * Cabeceras de seguridad.
   *
   * DELIBERADAMENTE SIN CSP. La aplicación inyecta un script en línea para
   * evitar el parpadeo al cargar el tema (ver src/lib/tema.ts y el
   * dangerouslySetInnerHTML de app/layout.tsx). Una CSP sin la excepción
   * correcta lo bloquearía y el tema volvería a parpadear — sin ningún
   * error visible. La CSP merece su propio paso, con esa excepción medida.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // La app se usa en el móvil y el cliente firma con el dedo en
          // ella: esa pantalla no debe poder incrustarse en ningún sitio.
          { key: "X-Frame-Options", value: "DENY" },
          // Pesa sobre /api/fotos, que devuelve contenido cuyo tipo lo
          // declaró quien lo subió.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera=(self) es NECESARIO: el técnico hace las fotos desde el
          // navegador. Quitarlo rompe la subida de fotos.
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
