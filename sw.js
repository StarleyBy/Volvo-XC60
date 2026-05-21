const CACHE_NAME = 'cs-helper-v14';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './app-manifest.yml',
  './libs/js-yaml.min.js',
  './libs/marked.min.js',
  './manifest.json',
  './books/icd/diagnoses.json',
  './books/icd/procedures.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log(`[SW] Installing ${CACHE_NAME} and pre-caching core assets...`);
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`[SW] Could not pre-cache: ${url}. Check if file exists on server.`);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  // Network First Strategy
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then(cached => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
