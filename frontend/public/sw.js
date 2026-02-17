// Minimal service worker for PWA installability (Chrome requires it for beforeinstallprompt)
const CACHE = 'monthly-split-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first: no caching required for install; just pass through
  event.respondWith(fetch(event.request));
});
