const CACHE = 'daymark-shell-v6';
const BASE = new URL('./', self.registration.scope);
const SHELL = ['index.html', 'offline.html', 'styles.css', 'theme.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'src/main.js', 'src/store.js', 'src/date.js', 'src/analytics.js', 'src/monthly.js', 'src/pdf.js', 'src/notifications.js', 'src/timetable.js'].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('daymark-shell-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE.href)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) await (await caches.open(CACHE)).put(new URL('index.html', BASE).href, response.clone());
      return response;
    }).catch(async () => (await caches.match(new URL('index.html', BASE).href)) || caches.match(new URL('offline.html', BASE).href)));
    return;
  }
  event.respondWith(fetch(request).then(async response => {
    if (response.ok) await (await caches.open(CACHE)).put(request, response.clone());
    return response;
  }).catch(() => caches.match(request)));
});
