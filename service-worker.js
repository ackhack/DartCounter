const CACHE_NAME = 'dartcounter-v14';
const ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/setup.css',
  '/css/game.css',
  '/css/modal.css',
  '/css/stats.css',
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
  '/js/dartit-bridge.js',
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

// ===========================
// DARTIT BRIDGE — receive throws from the Firefox add-on
// ===========================

// Turn a raw detect response into a throw token that applyThrowToken()
// (js/input.js) understands, e.g. "T11", "D20", "15", "Bull", "BE", "0".
// Returns null for anything unrecognised so we never score a bad throw.
function parseDetect(data) {
  if (!data) return null;
  const fields = String(data.fields || '').toUpperCase();
  const num = data.numbers;

  // Bull / bullseye — explicit field indicators win; numbers:25 is only the
  // fallback when fields doesn't already name the ring.
  if (fields === 'BE' || fields === 'BULLSEYE' || (num === 25 && fields === 'D')) return 'BE';
  if (fields === 'B' || num === 25) return 'Bull';

  // Miss
  if (fields === '0' || fields === 'M' || fields === 'MISS' || num === 0) return '0';

  // Numbered sections (single / double / triple)
  if (Number.isInteger(num) && num >= 1 && num <= 20) {
    if (fields === 'T') return 'T' + num;
    if (fields === 'D') return 'D' + num;
    return String(num);
  }

  return null;
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'dartit-detect') return;

  const raw = msg.data;
  console.log('[dartit-bridge] site SW got detect:', raw);

  const token = parseDetect(raw);
  if (!token) {
    console.warn('[dartit-bridge] site SW could not parse detect response:', raw);
    return;
  }

  console.log('[dartit-bridge] site SW parsed token:', token);

  self.clients
    .matchAll({ type: 'window' })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'dartit-throw', token: token, raw: raw });
      });
    });
});
