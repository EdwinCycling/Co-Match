// Simple service worker to enable PWA installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only intercept same-origin requests to avoid breaking CORS for external assets like Firebase
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback or just let it fail naturally
        return new Response('Network error occurred', { status: 408 });
      })
    );
  }
});
