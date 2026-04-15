/*
 * Nexora Multi-Proxy Service Worker
 * Routes requests through Scramjet or Ultraviolet based on URL prefix.
 * Rammerhead is server-side and does not use this SW.
 *
 * Scripts are imported at the top level (required by SW spec), but the
 * proxy worker *constructors* (which trigger BareMux SharedWorker
 * connections) are deferred until the first proxy-prefixed request.
 * This avoids BareMux retry spam on normal page loads.
 */

// ── Import scripts at top level (SW spec requirement) ──
// Cache-bust version — change on every deploy to force SW update
const SW_VERSION = '2026.04.15a';
importScripts("/s/uv/uv.bundle.js?v=" + SW_VERSION);
importScripts("/s/uv/uv.config.js?v=" + SW_VERSION);
importScripts(self.__uv$config.sw + "?v=" + SW_VERSION);
importScripts("/s/scram/scramjet.all.js?v=" + SW_VERSION);

// ── Known proxy prefixes (must match config) ──
const UV_PREFIX = self.__uv$config.prefix;        // "/s/uv/service/"
const SCRAMJET_PREFIX = "/scramjet/";
const SCRAMJET_WASM = "/s/scram/scramjet.wasm";

// ── Lazy-initialized proxy workers ──
let uv = null;
let scramjet = null;

function ensureProxies() {
  if (!uv) uv = new UVServiceWorker();
  if (!scramjet) {
    const { ScramjetServiceWorker } = $scramjetLoadWorker();
    scramjet = new ScramjetServiceWorker();
  }
}

function isProxyRequest(url) {
  const path = new URL(url).pathname;
  return path.startsWith(UV_PREFIX) ||
         path.startsWith(SCRAMJET_PREFIX) ||
         path.startsWith(SCRAMJET_WASM);
}

self.addEventListener("fetch", (event) => {
  // Only intercept proxy-prefixed requests; let everything else pass through natively
  if (!isProxyRequest(event.request.url)) return;

  event.respondWith(
    (async () => {
      ensureProxies();

      await scramjet.loadConfig();

      // Scramjet routes first
      if (scramjet.config && scramjet.route(event)) {
        return scramjet.fetch(event);
      }

      // Ultraviolet routes
      if (event.request.url.startsWith(location.origin + UV_PREFIX)) {
        return uv.fetch(event);
      }

      // Safety fallback
      return fetch(event.request);
    })()
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
