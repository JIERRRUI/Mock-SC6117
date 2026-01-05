const CACHE_NAME = "synapse-v1";

// Install: Skip waiting to activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate: Clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Hybrid Strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. CDNs (Immutable libraries): Cache First, fallback to Network
  // This ensures fast loads and offline availability for React, Tailwind, D3
  const isCDN =
    url.hostname.includes("cdn") || url.hostname.includes("aistudiocdn");

  if (isCDN) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // Check for valid response
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            (networkResponse.type !== "cors" &&
              networkResponse.type !== "basic" &&
              networkResponse.type !== "opaque")
          ) {
            return networkResponse;
          }
          // Only cache GET requests
          if (event.request.method === "GET") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  } else {
    // 2. App Files (HTML, JS, CSS): Network First, fallback to Cache
    // This ensures we always get the latest version during development/usage if online,
    // but falls back to the last working version if offline.
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Only cache GET requests
          if (event.request.method === "GET") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});
