// ----- Config ---------------------------------------------------------------
const CACHE_NAME = "invoicestudio-v1";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/privacy",
  "/terms",
  "/manifest.json",
];

// ----- Install: precache app shell ------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately — don't wait for old tabs
  self.skipWaiting();
});

// ----- Activate: clean old caches -------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ----- Fetch: network-first for API, cache-first for static -----------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // API routes: network-first, fallback to offline (no cache)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstNoCache(request));
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (
    /\.(js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|ico|webp|avif)$/.test(
      url.pathname
    ) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request));
});

// ----- Strategies -----------------------------------------------------------

/**
 * Cache-first: serve from cache, update cache in background.
 * Ideal for versioned static assets that never change.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Refresh cache in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => {
        /* ignore */
      });
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Risorsa non disponibile offline", { status: 503 });
  }
}

/**
 * Network-first: try network, fall back to cache (if available).
 * Ideal for HTML pages (navigation).
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Ultimate fallback: offline page
    return caches.match("/");
  }
}

/**
 * Network-first with no cache fallback.
 * For API calls — don't serve stale data.
 */
async function networkFirstNoCache(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: "Nessuna connessione" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
