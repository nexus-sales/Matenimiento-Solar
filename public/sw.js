/*
 * Service worker deliberadamente conservador.
 *
 * QUÉ CACHEA: solo los archivos de /_next/static, que llevan un hash del
 * contenido en el nombre. Un archivo con hash nunca cambia — si cambia el
 * contenido, cambia el nombre — así que servirlo desde caché no puede
 * devolver nada obsoleto.
 *
 * QUÉ NO CACHEA, Y POR QUÉ: ni el HTML de las páginas, ni nada de /api.
 *
 * Esta aplicación registra visitas que se firman y quedan inmutables. Si el
 * técnico viera un checklist cacheado y lo diera por bueno, estaría firmando
 * un estado que no es el de la base de datos. Una caché de datos aquí no es
 * una optimización: es un riesgo sobre un documento con valor de acta.
 *
 * El trabajo sin cobertura no se resuelve cacheando respuestas, sino
 * encolando los cambios para reenviarlos. Eso es una funcionalidad aparte,
 * no está hecha, y no se finge aquí.
 */

const CACHE = "sr-estaticos-v1";

self.addEventListener("install", (evento) => {
  // Sin precarga: se cachea lo que se vaya usando. Precargar obligaría a
  // mantener una lista de archivos que cambia en cada compilación.
  evento.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Fuera las cachés de versiones anteriores.
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);

  // Solo lo propio: una petición a otro dominio no se toca.
  if (url.origin !== self.location.origin) return;

  // Los recursos con hash son inmutables: caché primero, y solo se va a la
  // red la primera vez.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(
      (async () => {
        const cacheado = await caches.match(peticion);
        if (cacheado) return cacheado;

        const respuesta = await fetch(peticion);
        if (respuesta.ok) {
          const cache = await caches.open(CACHE);
          cache.put(peticion, respuesta.clone());
        }
        return respuesta;
      })()
    );
    return;
  }

  // Todo lo demás —páginas, API, fotos— va a la red sin intermediarios.
  // El manejador existe igualmente porque los navegadores lo exigen para
  // considerar la aplicación instalable.
});
