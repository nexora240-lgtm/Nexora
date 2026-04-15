let host = location.protocol + "//" + location.host;

var _CONFIG = {
  wispurl:
    localStorage.getItem("settings.wispUrl") ||
    "wss://69.164.244.149/wisp/",
  bareurl:
    localStorage.getItem("settings.bareUrl") ||
    "https://69.164.244.149/bare/",
  rammerheadUrl:
    localStorage.getItem("settings.rammerheadUrl") ||
    "https://69.164.244.149",
  // Views API Configuration - Replace with your AWS API Gateway URL
  viewsApiUrl: "https://2zpvhn3woh.execute-api.us-east-2.amazonaws.com",
  // Auth API Configuration - User authentication and data sync
  authApiUrl: "https://2zpvhn3woh.execute-api.us-east-2.amazonaws.com",
  // Admin API Configuration
  adminApiUrl: "https://2zpvhn3woh.execute-api.us-east-2.amazonaws.com",
  // Link Finder AI API Configuration — Replace with your deployed API Gateway URL
  linkFinderApiUrl: "https://o9xip5w3zi.execute-api.us-east-2.amazonaws.com",
  // Link Finder Admin API Key — Must match ADMIN_API_KEY in your Lambda env vars
  linkAdminApiKey: "nxlf-adm-8f3a2b7c-e91d-4c6f-b850-1d7e9a3f5c24",
  // VidPlus Proxy — CloudFront → API Gateway → Lambda → VPS (FlareSolverr) → vidplus.pro
  // CloudFront caches /_next/ chunks to avoid Lambda concurrency throttling
  vidplusProxyUrl: "https://dxh0uvcdj7oge.cloudfront.net",

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
