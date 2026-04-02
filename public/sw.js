// LS Event Manager — Service Worker v202604022343
const CACHE = "ls-events-202604022343";

// Only cache static assets with hashed filenames (Vite output)
// Do NOT cache index.html — always serve it from network so new deploys work
const ASSET_RE = /\/assets\/.+\.(js|css|woff2?|png|svg|jpg|webp)$/;

self.addEventListener("install", e => {
  self.skipWaiting(); // Take over immediately
});

self.addEventListener("activate", e => {
  // Delete ALL old caches
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log("[SW] deleting old cache:", k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = e.request.url;

  // Skip: non-GET, Supabase, Resend, cross-origin APIs
  if (e.request.method !== "GET") return;
  if (url.includes("supabase.co") || url.includes("resend.com")) return;
  if (url.includes("api.anthropic")) return;

  // For hashed assets: cache-first (they never change)
  if (ASSET_RE.test(url)) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // For everything else (including index.html): network-first, cache as fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache SVGs and icons for offline use
        if (res.ok && (url.endsWith(".svg") || url.includes("manifest"))) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
