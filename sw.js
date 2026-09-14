/* Service worker — Mapa de Antenas ES (gerado por build_pwa.py) */
const VERSION = 'bb1a70afdf';
const SHELL = 'shell-' + VERSION;      // arquivos do app (troca a cada build)
const TILES = 'tiles-v1';              // tiles de mapa já vistos (persistem entre builds)
const MAX_TILES = 2500;                // limite de tiles guardados
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./lib/leaflet.css", "./lib/leaflet.js", "./lib/leaflet.markercluster.js", "./lib/MarkerCluster.css", "./lib/MarkerCluster.Default.css", "./lib/images/layers-2x.png", "./lib/images/layers.png", "./lib/images/marker-icon-2x.png", "./lib/images/marker-icon.png", "./lib/images/marker-shadow.png", "./app.enc"];
const TILE_HOSTS = ['server.arcgisonline.com'];
const NETWORK_ONLY = ['overpass-api.de', 'nominatim.openstreetmap.org'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // Overpass usa POST: sempre rede
  const url = new URL(req.url);

  if (NETWORK_ONLY.some(h => url.hostname.endsWith(h))) return;   // dados dinâmicos: sempre rede

  if (TILE_HOSTS.includes(url.hostname)) {                // tiles: cache primeiro (offline em campo)
    e.respondWith(cacheFirst(req, TILES, true));
    return;
  }

  if (url.origin === location.origin) {                   // arquivos do app
    if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
      e.respondWith(networkFirst(req));                   // HTML: pega atualização se houver rede
    } else {
      e.respondWith(cacheFirst(req, SHELL, false));       // lib/ícones: cache primeiro
    }
  }
});

async function cacheFirst(req, cacheName, isTiles) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // tiles vêm como resposta "opaque" (sem CORS): ok guardar mesmo assim
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone());
      if (isTiles && Math.random() < 0.02) trimCache(cache, MAX_TILES);
    }
    return res;
  } catch (err) {
    return hit || Response.error();
  }
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const k of keys.slice(0, keys.length - max)) await cache.delete(k);
}
