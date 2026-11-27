// Service worker Fuel: app installabile e usabile offline.
// Bump CACHE a ogni modifica dei file per forzare l'aggiornamento.
const CACHE = 'fuel-v5';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './config.js',
  './manifest.webmanifest', './brand/logo.png',
  './data/ciclizzazione.json', './data/alimentazione.json',
  './data/allenamento.json', './data/integrazione.json',
  './icon/icon-192.png', './icon/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // le scritture pesi (POST) vanno sempre in rete
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;        // Supabase ecc. non li gestiamo qui
  // NETWORK-FIRST: online mostri sempre l'ultima versione; offline (palestra) usi la cache.
  e.respondWith(
    fetch(req).then(r => {
      if (r && r.ok) { const cc = r.clone(); caches.open(CACHE).then(c => c.put(req, cc)); }
      return r;
    }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
  );
});
