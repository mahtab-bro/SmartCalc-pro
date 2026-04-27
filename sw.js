const CACHE_NAME = 'smartcalc-v2';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',        // Add your CSS filename
  '/script.js',        // Add your JS filename
  '/index.js'          // Add other JS files
];

// Install — cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network FIRST, fallback to cache (works offline + updates fast)
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request)) // Offline fallback
  );
});
