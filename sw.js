const CACHE_NAME = 'volvo-v2';

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

  // ПОЛНЫЙ ОБХОД ДЛЯ GOOGLE SCRIPTS (решает CORS и Redirects)
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    return; // Позволяем браузеру обработать запрос напрямую
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
          // Возвращаем пустой ответ вместо undefined, чтобы избежать ошибки "Failed to convert to Response"
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
      })
  );
});
