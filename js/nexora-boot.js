(function () {
  const COOKIE_NAME = 'nexora_disguise';
  const COOKIE_FAV = 'nexora_favicon';
  const THEME_KEY = 'settings.theme';
  const SCHEME_KEY = 'settings.colorScheme';
  const DISGUISE_KEY = 'settings.disguise';
  const FAVICON_KEY = 'settings.faviconData';
  const CUSTOM_TITLE_KEY = 'settings.customTitle';
  const ABOUT_KEY = 'settings.aboutBlank';
  const DEFAULT_FALLBACK = '/assets/logos/nexora-bright.png';
  const CODE_LEVEL_TITLES = {
    "Clever": "Clever | Portal",
    "Google Classroom": "Home",
    "Canvas": "Dashboard",
    "Google Drive": "Home - Google Drive",
    "Seesaw": "Seesaw",
    "Edpuzzle": "Edpuzzle",
    "Kahoot!": "Enter Game PIN - Kahoot!",
    "Quizlet": "Your Sets | Quizlet",
    "Khan Academy": "Dashboard | Khan Academy"
  };

  // Auto-cloaking: Check if about:blank mode is enabled
  function checkAndApplyAutoCloaking() {
    try {
      // Check if we're already in an iframe (meaning we're already cloaked)
      if (window.self !== window.top) {
        return; // Already in iframe, don't re-cloak
      }

      // Check if this is first visit - don't auto-cloak during first-time setup
      const hasVisited = localStorage.getItem('nexora_hasVisited');
      if (!hasVisited) {
        return; // Let first-time visitor flow handle cloaking
      }

      // Check if about:blank is enabled
      const aboutBlankEnabled = localStorage.getItem(ABOUT_KEY);
      if (aboutBlankEnabled === 'true') {
        // Get disguise info for redirect
        const cookieDisguise = getCookie(COOKIE_NAME);
        const savedDisguise = cookieDisguise || localStorage.getItem(DISGUISE_KEY) || '';

        // Open about:blank window with the site
        const win = window.open('about:blank', '_blank');
        if (win) {
          try {
            const doc = win.document;
            doc.open();
            doc.write('<!DOCTYPE html><html><head><title>Loading...</title></head><body style="margin:0;padding:0;overflow:hidden;"></body></html>');
            doc.close();

            // Create iframe with the current site
            const iframe = doc.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.margin = '0';
            iframe.style.padding = '0';
            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.src = window.location.href;
            iframe.setAttribute('loading', 'eager');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            doc.body.appendChild(iframe);

            // Store window reference
            if (!window.opener) {
              window._aboutWin = win;
            }

            // Redirect original tab to disguise site
            const DISGUISE_URLS = {
              "Clever": "https://clever.com/",
              "Google Classroom": "https://classroom.google.com/",
              "Canvas": "https://canvas.instructure.com/",
              "Google Drive": "https://drive.google.com/",
              "Seesaw": "https://web.seesaw.me/",
              "Edpuzzle": "https://edpuzzle.com/",
              "Kahoot!": "https://kahoot.com/",
              "Quizlet": "https://quizlet.com/",
              "Khan Academy": "https://www.khanacademy.org/"
            };

            const redirectUrl = DISGUISE_URLS[savedDisguise] || 'https://classroom.google.com/';
            
            // Small delay to ensure iframe starts loading
            setTimeout(() => {
              window.location.replace(redirectUrl);
            }, 100);

          } catch (err) {
            console.error('Auto-cloaking setup error:', err);
            // If error, just let the page load normally
            win.close();
          }
        }
      }
    } catch (e) {
      // If any error (like localStorage access), just continue normally
      console.error('Auto-cloaking check error:', e);
    }
  }

  // Run auto-cloaking check immediately, before page loads
  checkAndApplyAutoCloaking();

  function getCookie(name) {
    try {
      const m = document.cookie.match('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }
  function setCookie(name, value, days = 365) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
      if (location.protocol === 'https:') cookie += '; Secure';
      document.cookie = cookie;
    } catch (e) {}
  }

  function removeFavicons() {
    try { Array.from(document.querySelectorAll('link[rel~="icon"]')).forEach(n => n.remove()); } catch (e) {}
  }

  function applyFaviconHref(href) {
    try {
      if (!href) href = DEFAULT_FALLBACK;
      removeFavicons();
      const link = document.createElement('link');
      link.rel = 'icon';
      if (/^data:image\/svg/i.test(href)) link.type = 'image/svg+xml';
      else if (/\.ico($|\?)/i.test(href)) link.type = 'image/x-icon';
      else if (/\.png($|\?)/i.test(href) || /^data:image\/png/i.test(href)) link.type = 'image/png';
      link.href = href;
      document.head.appendChild(link);
    } catch (e) {}
  }

  async function fetchAndApplyFavicon(url) {
    try {
      if (!/^https?:\/\//i.test(url)) { applyFaviconHref(url); return; }
      const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) { applyFaviconHref(url); return; }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      removeFavicons();
      const link = document.createElement('link'); link.rel = 'icon'; if (blob.type) link.type = blob.type; link.href = blobUrl; document.head.appendChild(link);
      const sep = url.includes('?') ? '&' : '?';
      const persisted = url + sep + '_n=' + Date.now();
      try { localStorage.setItem(FAVICON_KEY, persisted); setCookie(COOKIE_FAV, persisted); } catch (e) {}
      setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 60_000);
    } catch (e) { applyFaviconHref(url); }
  }

  function applySavedTitle() {
    try {
      const savedCustom = localStorage.getItem(CUSTOM_TITLE_KEY);
      if (savedCustom) { document.title = savedCustom; return; }
      const cookieDisguise = getCookie(COOKIE_NAME);
      const savedDisguise = cookieDisguise || localStorage.getItem(DISGUISE_KEY) || '';
      if (savedDisguise && CODE_LEVEL_TITLES[savedDisguise]) document.title = CODE_LEVEL_TITLES[savedDisguise];
    } catch (e) {}
  }

  function applySavedFavicon() {
    try {
      const cookieFav = getCookie(COOKIE_FAV);
      const saved = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
      if (!saved) {
        const existing = document.getElementById('page-favicon') || document.querySelector('link[rel~="icon"]');
        if (!existing) applyFaviconHref(DEFAULT_FALLBACK);
        return;
      }
      if (/^https?:\/\//i.test(saved)) {
        fetchAndApplyFavicon(saved);
      } else {
        applyFaviconHref(saved);
      }
    } catch (e) {}
  }

  function applySavedTheme() {
    try {
      const theme = localStorage.getItem(THEME_KEY);
      if (theme) {
        const map = {
          'midnight-amber': 'theme-midnight-amber',
          'midnight-blueberry': 'theme-midnight-blueberry',
          'midnight-grape': 'theme-midnight-grape'
        };
        const cls = map[theme];
        if (cls) {
          document.documentElement.classList.remove(...Object.values(map), 'light-scheme');
          document.documentElement.classList.add(cls);
        }
      }
      const scheme = localStorage.getItem(SCHEME_KEY);
      if (scheme === 'light') document.documentElement.classList.add('light-scheme');
      else if (scheme === 'dark') document.documentElement.classList.remove('light-scheme');
    } catch (e) {}
  }

  window.NexoraBoot = {
    applySavedTitle,
    applySavedFavicon,
    applySavedTheme,
    setCookie
  };

  try {
    applySavedTitle();
    applySavedFavicon();
    applySavedTheme();
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (window.NexoraSettings && typeof window.NexoraSettings.setFavicon === 'function') {
        try {
          const cookieFav = getCookie(COOKIE_FAV);
          const saved = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
          if (saved) window.NexoraSettings.setFavicon(saved).catch(()=>{});
        } catch (e) {}
      }
    }, { once: true });
  } else {
    if (window.NexoraSettings && typeof window.NexoraSettings.setFavicon === 'function') {
      try {
        const cookieFav = getCookie(COOKIE_FAV);
        const saved = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
        if (saved) window.NexoraSettings.setFavicon(saved).catch(()=>{});
      } catch (e) {}
    }
  }

})();
