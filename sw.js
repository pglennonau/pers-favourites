const CACHE = 'pers-favourites-0.27.32-shell-v4';
const SHELL = ['./','./index.html','./styles.css?v=0.27.32','./geo-fallback.js?v=0.27.32','./app.js?v=0.27.32','./config.js?v=0.27.32','./branding.js?v=0.27.32','./manifest.webmanifest','./terms.html','./privacy.html','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('/version.json')) { e.respondWith(fetch(e.request,{cache:'no-store'})); return; }
  e.respondWith(fetch(e.request).then(r => { const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
