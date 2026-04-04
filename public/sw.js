// LS Event Manager — Service Worker v2
const CACHE = "ls-events-v2";
const OFFLINE_URL = "/offline.html";

// Assets regex: hashed Vite output files
const ASSET_RE = /\/assets\/.+\.(js|css|woff2?|png|svg|jpg|webp)$/;

// Pre-cache on install
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        "/",
        "/manifest.json",
        "/icon-192.svg",
        "/icon-512.svg",
        "/offline.html",
      ]).catch(() => {}) // Don't fail install if some assets missing
    )
  );
  self.skipWaiting();
});

// Clean old caches on activate
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = e.request.url;

  // Skip non-GET, APIs
  if (e.request.method !== "GET") return;
  if (url.includes("supabase.co") || url.includes("resend.com") || url.includes("api.open-meteo") || url.includes("api.anthropic")) return;

  // Navigation requests (HTML pages): network-first, fallback to cache, then offline page
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() =>
          caches.match(e.request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Hashed assets: cache-first (immutable)
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

  // Fonts (Google Fonts): cache-first
  if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
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

  // Everything else: network-first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && (url.endsWith(".svg") || url.includes("manifest"))) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
