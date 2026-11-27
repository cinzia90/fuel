// Service worker Fuel: app installabile e usabile offline.
// Bump CACHE a ogni modifica dei file per forzare l'aggiornamento.
const CACHE = 'fuel-v3';
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
  if (url.origin !== location.origin) return;        // Supabase ecc. non li cache-iamo
  // network-first per i dati (cosi gli aggiornamenti mensili arrivano), cache-first per il resto
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then(r => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => caches.match(req)));
  } else {
    e.respondWith(caches.match(req).then(c => c || fetch(req)));
  }
});
