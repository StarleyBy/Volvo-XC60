const CACHE_NAME = 'volvo-v3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './app-manifest.yml',
  './libs/js-yaml.min.js',
  './libs/marked.min.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of STATIC_ASSETS) {
        try { await cache.add(url); } catch (err) {}
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
  const url = event.request.url;

  // ПОЛНЫЙ ИГНОР ДЛЯ GOOGLE (решает проблемы с CORS и Redirects в PWA)
  if (url.includes('google.com') || url.includes('googleusercontent.com') || url.includes('script.google.com')) {
    return; // Не вызываем event.respondWith — браузер делает нативный запрос
  }

  if (!url.startsWith('http')) return;

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
          return new Response('', { status: 404 });
        });
      })
  );
});
