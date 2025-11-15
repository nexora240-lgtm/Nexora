// Nexora Dynamic Loader
// Loads all site resources from CDN (jsdelivr)

const CDN_BASE = "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora@main";

async function loadNexora() {
  // Load main HTML content
  const mainHtml = await fetch(`${CDN_BASE}/index.html`)
    .then(r => r.text())
    .catch(err => {
      console.error("Failed to load main HTML:", err);
      return "<h1>Loading failed</h1>";
    });
  
  document.body.innerHTML = mainHtml;

  // Load CSS files
  const cssFiles = [
    "css/_tokens.css",
    "css/theme-tokens.css",
    "css/sidebar.css",
    "css/home.css",
    "css/games.css",
    "css/gameloader.css",
    "css/movies.css",
    "css/chatbot.css",
    "css/chatroom.css",
    "css/settings.css",
    "css/coming-soon.css",
    "css/first-time-modal.css"
  ];

  cssFiles.forEach(file => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${CDN_BASE}/${file}`;
    document.head.appendChild(link);
  });

  // Load JavaScript files in order
  const jsFiles = [
    "js/nexora-boot.js",
    "js/first-time-visitor.js",
    "js/settings.js",
    "js/views.js",
    "js/chatroom.js",
    "js/app.js"
  ];

  // Load JS files sequentially to maintain execution order
  for (const file of jsFiles) {
    const script = document.createElement("script");
    script.src = `${CDN_BASE}/${file}`;
    document.body.appendChild(script);
    
    // Wait for script to load before loading next one
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => {
        console.warn(`Failed to load ${file}`);
        resolve(); // Continue even if one fails
      };
    });
  }

  // Load service worker registration
  const swScript = document.createElement("script");
  swScript.src = `${CDN_BASE}/s/register-sw.js`;
  document.body.appendChild(swScript);

  console.log("Nexora loaded successfully from CDN");
}

// Auto-load on page ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadNexora);
} else {
  loadNexora();
}
