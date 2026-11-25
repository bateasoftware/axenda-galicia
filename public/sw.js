// Service worker de Axenda. Estrategia según el tipo de recurso:
// - Páginas: red primero; sin conexión, la última versión guardada (o la portada).
// - /_next/static: caché primero. Los nombres llevan hash, así que nunca cambian.
// - Carteles e imágenes optimizadas: caché primero y se refresca en segundo plano.
// - Lo demás (.ics, peticiones RSC, otros orígenes…): directo a la red.
// - /admin y /api: nunca. Son privados y dependen de la sesión y de redirecciones (el inicio de sesión):
//   no deben guardarse ni pasar por el service worker.
// Sube VERSION solo si cambia la lógica de este fichero: se borran las cachés antiguas.
const VERSION = "v3";
const PAGINAS = `axenda-paginas-${VERSION}`;
const ESTATICOS = `axenda-estaticos-${VERSION}`;
const IMAGENES = `axenda-imagenes-${VERSION}`;
const LIMITES = { [PAGINAS]: 40, [ESTATICOS]: 150, [IMAGENES]: 80 };

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.add("/")));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  const vigentes = Object.keys(LIMITES);
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !vigentes.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Guarda una respuesta válida y recorta la caché a su límite (borra las más antiguas) */
async function guardar(nombre, req, res) {
  if (!res || !res.ok || res.type !== "basic") return;
  const cache = await caches.open(nombre);
  await cache.put(req, res);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - LIMITES[nombre]))) await cache.delete(k);
}

async function redPrimero(e, req) {
  try {
    const res = await fetch(req);
    e.waitUntil(guardar(PAGINAS, req, res.clone()));
    return res;
  } catch {
    return (await caches.match(req, { ignoreSearch: true })) || (await caches.match("/")) || Response.error();
  }
}

async function cachePrimero(e, req, nombre, refrescar) {
  const guardada = await caches.match(req);
  // Solo se pide a la red si no estaba guardada o si hay que refrescarla
  const red = () =>
    fetch(req).then((res) => {
      e.waitUntil(guardar(nombre, req, res.clone()));
      return res;
    });
  if (guardada) {
    if (refrescar) e.waitUntil(red().catch(() => {}));
    return guardada;
  }
  return red().catch(() => Response.error());
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") return e.respondWith(redPrimero(e, req));
  if (url.pathname.startsWith("/_next/static/")) return e.respondWith(cachePrimero(e, req, ESTATICOS, false));
  if (url.pathname.startsWith("/carteles/") || url.pathname.startsWith("/_next/image"))
    return e.respondWith(cachePrimero(e, req, IMAGENES, true));
  // El resto no pasa por el service worker
});
