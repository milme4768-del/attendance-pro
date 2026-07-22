const CACHE = 'shiftlog-v1';
const ASSETS = [
  '/', '/login.html', '/user-dashboard.html', '/admin-dashboard.html',
  '/css/style.css', '/js/api.js', '/js/login.js', '/js/user-dashboard.js', '/js/admin-dashboard.js',
  '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ message: 'You are offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
  } else {
    e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
  }
});
