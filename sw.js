'use strict';
const CACHE = 'pers-favourites-v025-shell';
const SCOPE = self.registration.scope;
const INDEX = new URL('index.html', SCOPE).href;
const SHELL = ['', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']
  .map(path => new URL(path, SCOPE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pers-favourites-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(INDEX, copy));
      return r;
    }).catch(() => caches.match(INDEX)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(r => {
    if (r.ok) caches.open(CACHE).then(c => c.put(event.request, r.clone()));
    return r;
  })));
});
