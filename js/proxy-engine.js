/**
 * Nexora Proxy Engine
 * Orchestrates Scramjet, Ultraviolet, and Rammerhead proxies with
 * Libcurl / Epoxy transports and automatic fallback chains.
 *
 * Fallback order (Auto mode):
 *   Proxy:     Ultraviolet → Scramjet → Rammerhead
 *   Transport: Epoxy → Libcurl
 */
(function () {
  "use strict";

  // ── Settings Keys ──
  const KEYS = {
    proxyMode:      "settings.proxyMode",      // auto | scramjet | ultraviolet | rammerhead
    transportMode:  "settings.transportMode",   // auto | libcurl | epoxy
    searchEngine:   "settings.searchEngine",    // google | duckduckgo | bing | yahoo | brave | startpage
    bareUrl:        "settings.bareUrl",
    wispUrl:        "settings.wispUrl",
    rammerheadUrl:  "settings.rammerheadUrl",
    rhSessionId:    "proxy.rhSessionId",
    overridesCache: "proxy.adminOverrides",
    overridesTTL:   "proxy.adminOverridesTTL",
  };

  const FALLBACK_TIMEOUT = 10000; // ms per proxy attempt

  // ── Helpers ──
  function getSetting(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }
  function setSetting(key, val) {
    try { localStorage.setItem(key, val); } catch { /* private mode */ }
  }

  function isUrl(input) {
    if (/^https?:\/\//i.test(input)) return true;
    if (/^[\w-]+(\.[\w-]+)+/.test(input) && !input.includes(" ")) return true;
    return false;
  }

  function resolveUrl(input) {
    if (/^https?:\/\//i.test(input)) return input;
    if (isUrl(input)) return "https://" + input;
    // Search query
    const engine = getSetting(KEYS.searchEngine, "startpage");
    const tpl = (_CONFIG.searchEngines && _CONFIG.searchEngines[engine])
              || "https://www.google.com/search?q=%s";
    return tpl.replace("%s", encodeURIComponent(input));
  }

  function extractDomain(url) {
    try { return new URL(url).hostname; } catch { return ""; }
  }

  // ── BareMux Connection ──
  let _bareMuxConn = null;

  function getBareMuxConnection() {
    if (!_bareMuxConn && typeof BareMux !== "undefined") {
      _bareMuxConn = new BareMux.BareMuxConnection(_CONFIG.proxy.baremuxWorker);
    }
    return _bareMuxConn;
  }

  // ── Transport Management ──
  async function setTransport(type) {
    const conn = getBareMuxConnection();
    if (!conn) throw new Error("BareMux not loaded");
    const wispUrl = getSetting(KEYS.wispUrl, _CONFIG.wispurl);

    if (type === "libcurl") {
      await conn.setTransport(_CONFIG.proxy.libcurl, [{ wisp: wispUrl }]);
      console.log("[Nexora] Transport: libcurl →", wispUrl);
      return;
    }
    if (type === "epoxy") {
      await conn.setTransport(_CONFIG.proxy.epoxy, [{ wisp: wispUrl }]);
      console.log("[Nexora] Transport: epoxy →", wispUrl);
      return;
    }
    throw new Error("Unknown transport: " + type);
  }

  async function autoSetTransport() {
    const preferred = getSetting(KEYS.transportMode, "auto");
    if (preferred !== "auto") {
      await setTransport(preferred);
      return;
    }
    // Fallback: Epoxy → Libcurl
    try {
      await setTransport("epoxy");
    } catch (e) {
      console.warn("[Nexora] Epoxy failed, falling back to Libcurl:", e.message);
      await setTransport("libcurl");
    }
  }

  // ── Service Worker Registration ──
  let _swReady = false;

  async function registerServiceWorker() {
    if (_swReady) return;
    if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported");

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    console.log("[Nexora] SW registered, scope:", reg.scope);

    // Force check for updated SW on every page load
    reg.update().catch(() => {});

    // Wait for SW to be active
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
      });
    }
    _swReady = true;
  }

  // ── Scramjet Controller ──
  let _scramjetCtrl = null;

  function getScramjetController() {
    if (!_scramjetCtrl && typeof $scramjetLoadController === "function") {
      const { ScramjetController } = $scramjetLoadController();
      _scramjetCtrl = new ScramjetController({
        files: {
          wasm: _CONFIG.proxy.scramWasm,
          all:  _CONFIG.proxy.scramAll,
          sync: _CONFIG.proxy.scramSync,
        },
      });
      _scramjetCtrl.init();
    }
    return _scramjetCtrl;
  }

  // ── Scramjet Navigation ──
  function scramjetEncode(url) {
    const ctrl = getScramjetController();
    if (!ctrl) throw new Error("Scramjet controller unavailable");
    return ctrl.encodeUrl(url);
  }

  // ── Ultraviolet Navigation ──
  function uvEncode(url) {
    if (!self.__uv$config) throw new Error("UV config not loaded");
    const encoded = self.__uv$config.encodeUrl(url);
    return self.__uv$config.prefix + encoded;
  }

  // ── Rammerhead Client ──
  const RammerheadClient = {
    getBaseUrl() {
      return getSetting(KEYS.rammerheadUrl, _CONFIG.rammerheadUrl);
    },

    isConfigured() {
      const url = this.getBaseUrl();
      return url && url.length > 0;
    },

    async createSession() {
      const base = this.getBaseUrl();
      const resp = await fetch(base + "/newsession", { method: "GET" });
      if (!resp.ok) throw new Error("Rammerhead session creation failed: " + resp.status);
      const id = await resp.text();
      setSetting(KEYS.rhSessionId, id.trim());
      return id.trim();
    },

    async getSession() {
      const cached = getSetting(KEYS.rhSessionId, "");
      if (cached) {
        // Verify it still exists
        try {
          const base = this.getBaseUrl();
          const resp = await fetch(base + "/sessionexists?id=" + encodeURIComponent(cached));
          const exists = (await resp.text()).trim();
          if (exists === "exists" || exists === "true") return cached;
        } catch { /* fall through to create new */ }
      }
      return this.createSession();
    },

    async encode(url) {
      const session = await this.getSession();
      const base = this.getBaseUrl();
      return base + "/" + session + "/" + url;
    },
  };

  // ── Admin Override System ──
  const OVERRIDES_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async function fetchAdminOverrides() {
    try {
      const ttl = parseInt(getSetting(KEYS.overridesTTL, "0"), 10);
      if (Date.now() < ttl) {
        return JSON.parse(getSetting(KEYS.overridesCache, "[]"));
      }
      // Only fetch overrides if user is authenticated (avoids noisy 405/401 in console)
      const token = window.NexoraAuth && window.NexoraAuth.getToken ? window.NexoraAuth.getToken() : "";
      if (!token) return JSON.parse(getSetting(KEYS.overridesCache, "[]"));
      const resp = await fetch(_CONFIG.adminApiUrl + "/admin/proxy-overrides", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const overrides = data.overrides || data || [];
      setSetting(KEYS.overridesCache, JSON.stringify(overrides));
      setSetting(KEYS.overridesTTL, String(Date.now() + OVERRIDES_TTL_MS));
      return overrides;
    } catch {
      return JSON.parse(getSetting(KEYS.overridesCache, "[]"));
    }
  }

  function matchOverride(domain, overrides) {
    for (const rule of overrides) {
      const pattern = rule.domainPattern || "";
      if (pattern === domain) return rule;
      // Wildcard *.example.com
      if (pattern.startsWith("*.")) {
        const suffix = pattern.slice(1); // .example.com
        if (domain.endsWith(suffix) || domain === pattern.slice(2)) return rule;
      }
    }
    return null;
  }

  // ── Core Navigation with Fallback ──
  async function navigateWithProxy(url, proxyType) {
    switch (proxyType) {
      case "scramjet":
        return scramjetEncode(url);
      case "ultraviolet":
        return uvEncode(url);
      case "rammerhead":
        if (!RammerheadClient.isConfigured()) throw new Error("Rammerhead not configured");
        return RammerheadClient.encode(url);
      default:
        throw new Error("Unknown proxy type: " + proxyType);
    }
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
    ]);
  }

  // ── Public ProxyEngine API ──
  const ProxyEngine = {
    _initialized: false,
    _overrides: [],

    async init() {
      if (this._initialized) return;
      try {
        await autoSetTransport();
        await registerServiceWorker();
        getScramjetController();
        this._overrides = await fetchAdminOverrides();
        this._initialized = true;
        console.log("[Nexora] Proxy engine initialized");
      } catch (e) {
        console.error("[Nexora] Proxy engine init failed:", e);
        throw e;
      }
    },

    async reinitTransport() {
      await autoSetTransport();
    },

    resolveUrl(input) {
      return resolveUrl(input);
    },

    async navigate(input) {
      if (!this._initialized) await this.init();

      const url = resolveUrl(input);
      const domain = extractDomain(url);
      const mode = getSetting(KEYS.proxyMode, "auto");

      // Check admin overrides
      const override = matchOverride(domain, this._overrides);
      let proxyOrder;
      let transportOverride = null;

      if (override) {
        const op = override.proxyType || "auto";
        const ot = override.transportType || "auto";
        if (op !== "auto") proxyOrder = [op];
        if (ot !== "auto") transportOverride = ot;
      }

      if (!proxyOrder) {
        if (mode === "auto") {
          proxyOrder = ["ultraviolet", "scramjet"];
          if (RammerheadClient.isConfigured()) proxyOrder.push("rammerhead");
        } else {
          proxyOrder = [mode];
        }
      }

      // Apply transport override if admin specifies one
      if (transportOverride) {
        try { await setTransport(transportOverride); } catch (e) {
          console.warn("[Nexora] Admin transport override failed:", e.message);
        }
      }

      // Try each proxy in order
      let lastError;
      for (const proxy of proxyOrder) {
        try {
          console.log("[Nexora] Trying proxy:", proxy, "for", domain);
          const proxyUrl = await withTimeout(navigateWithProxy(url, proxy), FALLBACK_TIMEOUT);
          console.log("[Nexora] Success with", proxy);
          return { proxyUrl, proxyType: proxy, originalUrl: url };
        } catch (e) {
          console.warn("[Nexora] Proxy", proxy, "failed:", e.message);
          lastError = e;
        }
      }

      throw new Error("All proxies failed. Last error: " + (lastError ? lastError.message : "unknown"));
    },

    getSettings() {
      return {
        proxyMode:     getSetting(KEYS.proxyMode, "auto"),
        transportMode: getSetting(KEYS.transportMode, "auto"),
        searchEngine:  getSetting(KEYS.searchEngine, "startpage"),
        bareUrl:       getSetting(KEYS.bareUrl, _CONFIG.bareurl),
        wispUrl:       getSetting(KEYS.wispUrl, _CONFIG.wispurl),
        rammerheadUrl: getSetting(KEYS.rammerheadUrl, _CONFIG.rammerheadUrl),
      };
    },

    RammerheadClient,
    KEYS,
  };

  window.NexoraProxy = ProxyEngine;
})();
