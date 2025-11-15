// Nexora Dynamic Loader
// Loads all site resources from CDN (jsdelivr)
// Use this in a separate HTML file to load the entire Nexora site

const CDN_BASE = "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora@main";

async function loadNexora() {
  console.log("Starting Nexora loader from CDN...");

  // Set up meta tags
  document.title = "Nexora";
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }

  // Add favicon
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.id = "favicon";
  favicon.href = `${CDN_BASE}/assets/logos/nexora-amber.png`;
  document.head.appendChild(favicon);

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

  // Add theme initialization script to head (before content loads)
  const themeInitScript = document.createElement("script");
  themeInitScript.textContent = `
    (function () {
      try {
        var THEME_KEY = 'settings.theme';
        var SCHEME_KEY = 'settings.colorScheme';
        var MAP = {
          'midnight-amber': 'theme-midnight-amber',
          'midnight-blueberry': 'theme-midnight-blueberry',
          'midnight-grape': 'theme-midnight-grape'
        };
        var savedTheme = null;
        var savedScheme = null;
        try {
          savedTheme = localStorage.getItem(THEME_KEY);
          savedScheme = localStorage.getItem(SCHEME_KEY);
        } catch (e) {
          savedTheme = null;
          savedScheme = null;
        }
        var doc = document.documentElement;
        if (savedScheme === 'light') {
          doc.classList.add('light-scheme');
          doc.classList.remove('theme-midnight-amber','theme-midnight-blueberry','theme-midnight-grape');
          doc.setAttribute('data-restored-theme', 'light');
        } else {
          if (savedTheme && MAP[savedTheme]) {
            doc.classList.add(MAP[savedTheme]);
            doc.setAttribute('data-restored-theme', savedTheme);
          } else {
            doc.classList.add('theme-midnight-amber');
            doc.setAttribute('data-restored-theme', 'midnight-amber');
          }
        }
      } catch (err) {}
    })();
  `;
  document.head.appendChild(themeInitScript);

  // Fetch and inject ONLY the body content from home.html
  const homeHtml = await fetch(`${CDN_BASE}/home.html`)
    .then(r => r.text())
    .catch(err => {
      console.error("Failed to load home HTML:", err);
      return "<section class='home'><div class='content'><h1>Loading failed</h1></div></section>";
    });
  
  // Extract only the body content (between <body> and </body>)
  const bodyMatch = homeHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : homeHtml;
  document.body.innerHTML = bodyContent;

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
  const pagePromises = htmlPages.map(async (page) => {
    try {
      const content = await fetch(`${CDN_BASE}/${page}`).then(r => r.text());
      // Extract body content only
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      window.nexoraPages[page] = bodyMatch ? bodyMatch[1] : content;
      console.log(`✓ Preloaded: ${page}`);
    } catch (err) {
      console.warn(`✗ Failed to preload ${page}:`, err);
    }
  });

  await Promise.all(pagePromises);

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
        console.log(`✓ Loaded: ${file}`);
        resolve();
      };
      script.onerror = () => {
        console.warn(`✗ Failed to load ${file}`);
        resolve(); // Continue even if one fails
      };
    });
  }

  // Load service worker scripts (not UV-related files that need special handling)
  const swFiles = [
    "s/register-sw.js",
    "s/index.js",
    "s/search.js",
    "s/embed.js",
    "s/uv-sw.js"
  ];

  for (const file of swFiles) {
    try {
      const script = document.createElement("script");
      script.src = `${CDN_BASE}/${file}`;
      document.body.appendChild(script);
      console.log(`✓ Queued: ${file}`);
    } catch (err) {
      console.warn(`✗ Failed to load ${file}:`, err);
    }
  }

  // Load UV (Ultraviolet) proxy files
  const uvFiles = [
    "s/uv/uv.bundle.js",
    "s/uv/uv.config.js",
    "s/uv/uv.handler.js",
    "s/uv/uv.sw.js"
  ];

  for (const file of uvFiles) {
    try {
      const script = document.createElement("script");
      script.src = `${CDN_BASE}/${file}`;
      document.body.appendChild(script);
      console.log(`✓ Queued: ${file}`);
    } catch (err) {
      console.warn(`✗ Failed to load ${file}:`, err);
    }
  }

  // Load game info JSON
  try {
    const gameInfo = await fetch(`${CDN_BASE}/game-info.json`).then(r => r.json());
    window.nexoraGameInfo = gameInfo;
    console.log("✓ Loaded game-info.json");
  } catch (err) {
    console.warn("✗ Failed to load game-info.json:", err);
  }

  // Load static files metadata
  try {
    const [adsTxt, robotsTxt, sitemap] = await Promise.all([
      fetch(`${CDN_BASE}/ads.txt`).then(r => r.text()).catch(() => null),
      fetch(`${CDN_BASE}/robots.txt`).then(r => r.text()).catch(() => null),
      fetch(`${CDN_BASE}/sitemap.xml`).then(r => r.text()).catch(() => null)
    ]);
    
    window.nexoraStaticFiles = { adsTxt, robotsTxt, sitemap };
    console.log("✓ Loaded static files");
  } catch (err) {
    console.warn("✗ Failed to load static files:", err);
  }

  console.log("🚀 Nexora fully loaded from CDN!");
}

// Auto-load on page ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadNexora);
} else {
  loadNexora();
}
