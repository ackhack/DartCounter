const CACHE_NAME = 'dartcounter-v11';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/constants.js',
  '/js/storage.js',
  '/js/state.js',
  '/js/setup.js',
  '/js/game-flow.js',
  '/js/input.js',
  '/js/undo.js',
  '/js/scoring.js',
  '/js/render.js',
  '/js/stats-screen.js',
  '/js/end-game.js',
  '/js/main.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install — cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});
