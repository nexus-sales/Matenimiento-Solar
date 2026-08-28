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
};

export default nextConfig;
