// Nexora Dynamic Loader
// Loads all site resources from CDN (jsdelivr)
// Use this in a separate HTML file to load the entire Nexora site

const CDN_BASE = "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora@main";

async function loadNexora() {
  console.log("Starting Nexora loader...");

  // Create a loading indicator
  document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><h2>Loading Nexora...</h2></div>';

  // Load all CSS files first
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

  // Load Google Fonts
  const fontsLink = document.createElement("link");
  fontsLink.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap";
  fontsLink.rel = "stylesheet";
  document.head.appendChild(fontsLink);

  // Load Google Analytics
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-H5VGHQJKD8";
  document.head.appendChild(gaScript);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-H5VGHQJKD8');

  // Fetch and inject the body content from home.html (not index.html to avoid recursion)
  const homeHtml = await fetch(`${CDN_BASE}/home.html`)
    .then(r => r.text())
    .catch(err => {
      console.error("Failed to load home HTML:", err);
      return "<h1>Loading failed</h1>";
    });
  
  document.body.innerHTML = homeHtml;

  // Load all HTML page files as preloaded content
  const htmlPages = [
    "chatbot.html",
    "chatroom.html",
    "cookies.html",
    "gameloader.html",
    "games.html",
    "movies.html",
    "privacy-policy.html",
    "proxy.html",
    "settings.html"
  ];

  // Preload HTML pages into memory for faster navigation
  window.nexoraPages = {};
  for (const page of htmlPages) {
    try {
      const content = await fetch(`${CDN_BASE}/${page}`).then(r => r.text());
      window.nexoraPages[page] = content;
      console.log(`Preloaded: ${page}`);
    } catch (err) {
      console.warn(`Failed to preload ${page}:`, err);
    }
  }

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
    await new Promise((resolve) => {
      script.onload = () => {
        console.log(`Loaded: ${file}`);
        resolve();
      };
      script.onerror = () => {
        console.warn(`Failed to load ${file}`);
        resolve(); // Continue even if one fails
      };
    });
  }

  // Load service worker scripts
  const swFiles = [
    "s/register-sw.js",
    "s/index.js",
    "s/search.js",
    "s/embed.js"
  ];

  for (const file of swFiles) {
    const script = document.createElement("script");
    script.src = `${CDN_BASE}/${file}`;
    document.body.appendChild(script);
  }

  // Load game info JSON
  try {
    const gameInfo = await fetch(`${CDN_BASE}/game-info.json`).then(r => r.json());
    window.nexoraGameInfo = gameInfo;
    console.log("Loaded game-info.json");
  } catch (err) {
    console.warn("Failed to load game-info.json:", err);
  }

  console.log("✅ Nexora loaded successfully from CDN");
}

// Auto-load on page ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadNexora);
} else {
  loadNexora();
}
