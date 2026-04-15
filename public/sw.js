/* eslint-disable no-undef */
// Manual Service Worker — no build plugin.
// Bump CACHE_VERSION to invalidate old caches on deploy.

const CACHE_VERSION = "v1";
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL];

// ── install: precache offline fallback ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })()
  );
});

// ── activate: clean up old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("app-cache-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ── fetch: NetworkFirst (excluding API + non-GET) ──
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // Skip API requests entirely
  if (url.pathname.startsWith("/api/")) return;

  // Skip Next.js HMR / dev assets
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(req);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, networkResponse.clone()).catch(() => { /* ignore */ });
        }
        return networkResponse;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});

// ── push: Web Push notifications ──
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "알림", body: event.data.text() };
  }

  const title = payload.title || "알림";
  const options = {
    body: payload.body || "",
    icon: "/icons/launchericon-192x192.png",
    badge: "/icons/launchericon-96x96.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── notificationclick: focus or open window ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});
