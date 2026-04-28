/* ───────────────────────────────────────────────────────────
 * Nexora storage shim — must run BEFORE anything below uses
 * localStorage/sessionStorage. Some browsers (Edge tracking-prevention,
 * sandboxed iframes, private mode) make the very ACT of accessing
 * `window.localStorage` throw a SecurityError. We swap in an in-memory
 * Storage implementation in that case so the rest of the site keeps
 * working without try/catch around every call site.
 * ─────────────────────────────────────────────────────────── */
(function () {
  function probe(kind) {
    try {
      var s = window[kind];
      if (!s) return false;
      var k = '__nx_storage_probe__';
      s.setItem(k, '1');
      s.removeItem(k);
      return true;
    } catch (_) { return false; }
  }
  function makeMem() {
    var data = Object.create(null);
    return {
      get length() { return Object.keys(data).length; },
      key: function (i) { var k = Object.keys(data); return i >= 0 && i < k.length ? k[i] : null; },
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[String(k)] = String(v); },
      removeItem: function (k) { delete data[String(k)]; },
      clear: function () { data = Object.create(null); },
    };
  }
  function install(kind) {
    if (probe(kind)) return false;
    var shim = makeMem();
    try { Object.defineProperty(window, kind, { value: shim, configurable: true, writable: false }); }
    catch (_) { try { window[kind] = shim; } catch (__) {} }
    return true;
  }
  var fL = install('localStorage');
  var fS = install('sessionStorage');
  if (fL || fS) {
    try {
      console.warn('[NexoraStorageShim] Native ' +
        (fL && fS ? 'localStorage + sessionStorage' : fL ? 'localStorage' : 'sessionStorage') +
        ' blocked by browser. Using in-memory fallback.');
    } catch (_) {}
  }
})();

let host = location.protocol + "//" + location.host;

// Migrate legacy proxy endpoints that used the raw IP. The relay's TLS cert
// only covers nx-relay.thenexoraproject.xyz, so cached IP-based URLs cause
// WebSocket TLS handshake failures.
(function migrateLegacyProxyHosts() {
  try {
    const LEGACY = "69.164.244.149";
    const NEW = "nx-relay.thenexoraproject.xyz";
    ["settings.wispUrl", "settings.bareUrl", "settings.rammerheadUrl"].forEach((k) => {
      const v = localStorage.getItem(k);
      if (v && v.includes(LEGACY)) {
        localStorage.setItem(k, v.split(LEGACY).join(NEW));
      }
    });
  } catch { /* private mode */ }
})();

var _CONFIG = {
  wispurl:
    localStorage.getItem("settings.wispUrl") ||
    "wss://nexora-webdelivery404.b-cdn.net/wisp/",
  bareurl:
    localStorage.getItem("settings.bareUrl") ||
    "https://nexora-webdelivery404.b-cdn.net/bare/",
  rammerheadUrl:
    localStorage.getItem("settings.rammerheadUrl") ||
    "https://nexora-webdelivery404.b-cdn.net",
  // Views API Configuration - Replace with your AWS API Gateway URL
  viewsApiUrl: "https://8hxm0uu86k.execute-api.us-east-2.amazonaws.com",
  // Auth API Configuration - User authentication and data sync
  authApiUrl: "https://8hxm0uu86k.execute-api.us-east-2.amazonaws.com",
  // Admin API Configuration
  adminApiUrl: "https://8hxm0uu86k.execute-api.us-east-2.amazonaws.com",
  // Link Finder AI API Configuration — Replace with your deployed API Gateway URL
  linkFinderApiUrl: "https://8tz5t8akcd.execute-api.us-east-2.amazonaws.com",
  // Link Finder Admin API Key — Must match ADMIN_API_KEY in your Lambda env vars
  linkAdminApiKey: "nxlf-adm-8f3a2b7c-e91d-4c6f-b850-1d7e9a3f5c24",

  // ── Proxy Infrastructure ──
  // Asset paths for proxy bundles (relative to site root)
  proxy: {
    uvPrefix:     "/s/uv/service/",
    uvConfig:     "/s/uv/uv.config.js",
    uvBundle:     "/s/uv/uv.bundle.js",
    uvHandler:    "/s/uv/uv.handler.js",
    uvSw:         "/s/uv/uv.sw.js",
    scramAll:     "/s/scram/scramjet.all.js",
    scramSync:    "/s/scram/scramjet.sync.js",
    scramWasm:    "/s/scram/scramjet.wasm.wasm",
    baremuxWorker:"/s/baremux/worker.js",
    epoxy:        "/s/epoxy/index.mjs",
    libcurl:      "/s/libcurl/index.mjs",
  },

  // Search engine URL templates — %s is replaced with the encoded query
  searchEngines: {
    google:     "https://www.google.com/search?q=%s",
    duckduckgo: "https://duckduckgo.com/?q=%s",
    bing:       "https://www.bing.com/search?q=%s",
    yahoo:      "https://search.yahoo.com/search?p=%s",
    brave:      "https://search.brave.com/search?q=%s",
    startpage:  "https://www.startpage.com/do/dsearch?query=%s"
  }
};
