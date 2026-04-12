let host = location.protocol + "//" + location.host;

var _CONFIG = {
  wispurl:
    localStorage.getItem("proxServer") ||
    "wss://anura.pro/",
  bareurl: host + "/bare/",
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
  // VidPlus Proxy — API Gateway → Lambda → VPS (FlareSolverr) → vidplus.to
  // Set after running aws/vidplus-lambda/deploy.ps1 (e.g. "https://abc123.execute-api.us-east-2.amazonaws.com")
  vidplusProxyUrl: "https://hudzs7cvd1.execute-api.us-east-2.amazonaws.com"
};
