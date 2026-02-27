/**
 * GeoDiary - Service Worker (offline-first, GitHub Pages)
 *
 * Strategia: Network First – przy dostępnej sieci zwraca świeżą odpowiedź i zapisuje ją w DYNAMIC_CACHE;
 * przy braku sieci zwraca odpowiedź z cache. Dla nawigacji (np. details.html?id=xxx) przy braku sieci
 * szukamy w cache także po URL bez query (url.origin + url.pathname), żeby szczegóły wpisu działały offline.
 * Instalacja: cache statyczny (STATIC_ASSETS) zapisywany pojedynczo (Promise.allSettled), żeby jeden 404
 * nie blokował całego install. Scope i rejestracja: aplikacja rejestruje SW przez ./sw.js (względna ścieżka).
 */

/** Nazwa cache'a z zasobami statycznymi (strony HTML, CSS, JS, manifest, ikony, demo.json). */
const STATIC_CACHE = 'geoDiary-static-v2';
/** Nazwa cache'a na odpowiedzi z sieci (dynamicznie cache'owane przy Network First). */
const DYNAMIC_CACHE = 'geoDiary-dynamic-v2';

/** Lista URL-i do zapisania przy install (względne do scope SW). */
const STATIC_ASSETS = [
  './',
  './index.html',
  './add.html',
  './details.html',
  './offline.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/ui.js',
  './js/location.js',
  './js/camera.js',
  './manifest.json',
  './data/demo.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return Promise.allSettled(
        STATIC_ASSETS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('SW cache add failed:', url, err);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    }).catch(function (err) {
      console.warn('SW install:', err);
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== STATIC_CACHE && name !== DYNAMIC_CACHE) {
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/**
 * Cache First: sprawdza cache, zwraca z cache lub fetch z sieci.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      // Uwzględniamy 'cors' (np. kafelki OSM z tile.openstreetmap.org), żeby cache'ować odpowiedzi cross-origin.
      // if (response && response.status === 200 && response.type === 'basic') {
      if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
        var clone = response.clone();
        caches.open(DYNAMIC_CACHE).then(function (cache) {
          cache.put(request, clone);
        });
      }
      return response;
    });
  });
}

/**
 * Network First: próbuje fetch, przy sukcesie zapisuje w DYNAMIC_CACHE i zwraca response;
 * przy błędzie zwraca z cache.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
function networkFirst(request) {
  return fetch(request).then(function (response) {
    // Uwzględniamy 'cors' (np. kafelki OSM z tile.openstreetmap.org), żeby cache'ować odpowiedzi cross-origin.
    // if (response && response.status === 200 && response.type === 'basic') {
    if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
      var clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(function (cache) {
        cache.put(request, clone);
      });
    }
    return response;
  }).catch(function () {
    return caches.match(request);
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;
  if (request.url.startsWith('blob:')) return;

  var url = new URL(request.url);
  var path = url.pathname;
  var isSameOrigin = url.origin === self.location.origin;
  var relativePath = path.replace(/^\//, './');

  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin && (relativePath === './data/demo.json' || path.endsWith('/data/demo.json'))) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    // Świadomie Network First: aktualne HTML gdy sieć działa. Offline: szukamy w cache.
    // Ważne: cache ma klucze bez query (np. details.html), a nawigacja może być z query (details.html?id=xxx).
    // Dlatego próbujemy też URL bez query (url.origin + url.pathname), żeby szczegóły wpisu działały offline.
    var urlNoQuery = isSameOrigin ? (url.origin + url.pathname) : null;
    event.respondWith(
      networkFirst(request).then(function (response) {
        if (response) return response;
        var fallback = path.endsWith('/') || path === '' ? ['./', './index.html'] : [];
        if (urlNoQuery) fallback.push(urlNoQuery);
        fallback.push(request.url);
        return fallback.reduce(function (acc, u) {
          return acc.then(function (r) { return r || caches.match(u); });
        }, Promise.resolve(null)).then(function (r) { return r || caches.match('./offline.html'); });
      }).catch(function () {
        var tryOrder = urlNoQuery ? [request, urlNoQuery, './', './index.html'] : [request, './', './index.html'];
        return tryOrder.reduce(function (acc, u) {
          return acc.then(function (r) { return r || caches.match(u); });
        }, Promise.resolve(null)).then(function (r) { return r || caches.match('./offline.html'); });
      })
    );
    return;
  }

  if (isSameOrigin && (
    /\.(css|js)$/i.test(path) ||
    path.endsWith('/manifest.json') ||
    path.indexOf('/icons/') !== -1
  )) {
    // Świadomie Network First: aktualizacje CSS/JS/manifest/ikon bez utknięcia na starej wersji.
    // event.respondWith(cacheFirst(request));
    event.respondWith(networkFirst(request));
    return;
  }

  // Świadomie Network First dla pozostałych żądań (aktualna wersja zasobów).
  // event.respondWith(cacheFirst(request));
  event.respondWith(networkFirst(request));
});
