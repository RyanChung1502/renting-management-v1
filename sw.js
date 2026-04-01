const CACHE_NAME = 'rentmgr-v26';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/db.js',
    './js/state.js',
    './js/helpers.js',
    './js/voice.js',
    './js/ui.js',
    './js/billing.js',
    './js/canvas-export.js',
    './js/pages/rooms.js',
    './js/pages/tenants.js',
    './js/pages/electric.js',
    './js/pages/settings.js',
    './js/pages/backup.js',
    './js/app.js',
    './manifest.json'
];

// Install: cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
