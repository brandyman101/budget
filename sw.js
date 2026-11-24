/* Brandel Budget — service worker.
   Makes the site installable and usable offline.
   - App shell (HTML/manifest/icons) is precached on install.
   - Navigations are network-first with a cached-shell fallback, so a new
     deploy is picked up on the next online visit.
   - Same-origin GETs are stale-while-revalidate.
   - POSTs (sync) are never cached and always go to the network.
   - Cross-origin requests (CDN libraries) go straight to the network. */
var CACHE = 'budget-tracker-v20261124a';
var SHELL = [
  './',
  'index.html',
  'manifest.json',
  'logo-192.png',
  'logo-512.png',
  'logo-512-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return; // never cache writes (sync is POST)
  var url = new URL(req.url);

  // Navigations: network first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put('index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('index.html');
      })
    );
    return;
  }

  // Same-origin static assets: serve from cache, refresh in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }

  // Everything else (CDN libraries, etc.): straight to the network.
});
