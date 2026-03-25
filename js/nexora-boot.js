(function () {
  const COOKIE_NAME = 'nexora_disguise';
  const COOKIE_FAV = 'nexora_favicon';
  const THEME_KEY = 'settings.theme';
  const SCHEME_KEY = 'settings.colorScheme';
  const DISGUISE_KEY = 'settings.disguise';
  const FAVICON_KEY = 'settings.faviconData';
  const CUSTOM_TITLE_KEY = 'settings.customTitle';
  const ABOUT_KEY = 'settings.aboutBlank';
  const PERFORMANCE_PRESET_KEY = 'settings.performancePreset';
  const MOUSE_TRACKING_KEY = 'settings.mouseTracking';
  const ANIMATIONS_KEY = 'settings.animations';
  const GLOW_KEY = 'settings.glow';
  const BLUR_KEY = 'settings.blur';
  const TRANSFORMS_KEY = 'settings.transforms';
  const DEFAULT_FALLBACK = 'https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/logos/nexora-amber.png';
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

  const FAVICON_MAP = {
    "Clever": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/clever.ico",
    "Google Classroom": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/classroom.ico",
    "Canvas": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/canvas.png",
    "Google Drive": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/drive.png",
    "Seesaw": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/seesaw.jpg",
    "Edpuzzle": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/edpuzzle.png",
    "Kahoot!": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/kahoot.ico",
    "Quizlet": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/quizlet.png",
    "Khan Academy": "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/khanacademy.ico"
  };

  const PERFORMANCE_PRESETS = {
    fast: {
      mouseTracking: false,
      animations: false,
      glow: false,
      blur: false,
      transforms: false
    },
    normal: {
      mouseTracking: false,
      animations: true,
      glow: false,
      blur: true,
      transforms: false
    },
    fancy: {
      mouseTracking: true,
      animations: true,
      glow: true,
      blur: true,
      transforms: true
    }
  };

  function showPopupBlockedNotification() {
    // Remove any existing notification
    const existing = document.getElementById('popup-blocked-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'popup-blocked-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 24px 30px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 999999;
      font-family: 'Poppins', Arial, sans-serif;
      max-width: 420px;
      width: 90%;
      box-sizing: border-box;
      animation: slideDown 0.4s ease-out;
      text-align: center;
    `;

    // Create animated arrow
    const arrow = document.createElement('div');
    arrow.id = 'popup-arrow';
    arrow.style.cssText = `
      position: fixed;
      top: 10px;
      right: 290px;
      font-size: 48px;
      z-index: 999998;
      animation: bounce 1s infinite, glow 2s infinite;
      filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
      pointer-events: none;
    `;
    arrow.innerHTML = '👆';

    notification.innerHTML = `
      <style>
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)); }
          50% { filter: drop-shadow(0 0 20px rgba(255, 255, 255, 1)); }
        }
        #popup-blocked-notification h3 {
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 700;
        }
        #popup-blocked-notification p {
          margin: 0;
          font-size: 16px;
          line-height: 1.6;
          font-weight: 500;
        }
        #popup-blocked-notification .big-emoji {
          font-size: 64px;
          margin: 10px 0;
        }
      </style>
      <div class="big-emoji">🚫</div>
      <h3>⚠ Hide mode is blocked!</h3>
      <p>Your screen is <strong>visible</strong> right now.<br>Click the icon in your address bar, then <strong>allow pop-ups</strong> to fix it.</p>
    `;

    document.body.appendChild(notification);
    document.body.appendChild(arrow);

    // Auto-remove after showing for a while
    setTimeout(() => {
      if (notification.parentNode) notification.remove();
      if (arrow.parentNode) arrow.remove();
    }, 10000);
  }

  function isInAboutBlankIframe() {
    try {
      if (window.self === window.top) return false;
      // Use window.name set by the cloaking system as a reliable cross-frame signal
      if (window.name === 'nexora-cloaked') return true;
      // Fallback: try direct location check
      try { return window.top.location.href === 'about:blank'; } catch (e) {}
      // Fallback: if we're in an iframe and about:blank is enabled, likely cloaked
      return localStorage.getItem(ABOUT_KEY) === 'true';
    } catch (e) { return false; }
  }

  function showCloakingActiveBadge() {
    if (document.getElementById('nexora-cloak-badge')) return;
    function inject() {
      if (document.getElementById('nexora-cloak-badge')) return;
      const badge = document.createElement('div');
      badge.id = 'nexora-cloak-badge';
      badge.setAttribute('aria-label', 'Cloaking active');
      badge.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;' +
        'background:rgba(30,30,30,0.85);color:#4ade80;font-family:"Poppins",Arial,sans-serif;' +
        'font-size:13px;font-weight:600;padding:8px 16px;border-radius:10px;' +
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
        'border:1px solid rgba(74,222,128,0.25);pointer-events:none;' +
        'display:flex;align-items:center;gap:8px;opacity:0;transition:opacity 0.4s ease;';
      badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;' +
        'border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;"></span> Cloaking active';
      document.body.appendChild(badge);
      requestAnimationFrame(function () { badge.style.opacity = '1'; });
    }
    if (document.body) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  }

  // Expose about:blank state globally
  window.__nexoraIsAboutBlank = isInAboutBlankIframe();

  if (window.__nexoraIsAboutBlank) {
    showCloakingActiveBadge();
  }

  // Propagate disguise title + favicon to the parent about:blank document
  function syncDisguiseToParent() {
    if (!window.__nexoraIsAboutBlank) return;
    try {
      const parentDoc = window.top.document;
      if (!parentDoc) return;
      const cookieDisguise = getCookie(COOKIE_NAME);
      const savedDisguise = cookieDisguise || localStorage.getItem(DISGUISE_KEY) || '';
      if (savedDisguise && CODE_LEVEL_TITLES[savedDisguise]) {
        parentDoc.title = CODE_LEVEL_TITLES[savedDisguise];
      }
      const favUrl = savedDisguise && FAVICON_MAP[savedDisguise] ? FAVICON_MAP[savedDisguise] : '';
      if (favUrl) {
        try {
          var oldIcons = parentDoc.querySelectorAll('link[rel~="icon"]');
          for (var i = 0; i < oldIcons.length; i++) oldIcons[i].remove();
          var link = parentDoc.createElement('link');
          link.rel = 'icon';
          link.href = favUrl;
          parentDoc.head.appendChild(link);
        } catch (e) {}
      }
    } catch (e) {}
  }

  function checkAndApplyAutoCloaking() {
    try {

      if (window.self !== window.top) {
        return; // Already in iframe, don't re-cloak
      }

      const hasVisited = localStorage.getItem('nexora_hasVisited');
      if (!hasVisited) {
        return; // Let first-time visitor flow handle cloaking
      }

      const aboutBlankEnabled = localStorage.getItem(ABOUT_KEY);
      if (aboutBlankEnabled === 'true') {

        const cookieDisguise = getCookie(COOKIE_NAME);
        const savedDisguise = cookieDisguise || localStorage.getItem(DISGUISE_KEY) || '';

        const win = window.open('about:blank', '_blank');
        
        // Check if popup was blocked
        if (!win || win.closed || typeof win.closed === 'undefined') {
          // Popup was blocked, show notification
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showPopupBlockedNotification);
          } else {
            showPopupBlockedNotification();
          }
          return;
        }

        if (win) {
          try {
            const doc = win.document;
            const disguiseTitle = savedDisguise && CODE_LEVEL_TITLES[savedDisguise] ? CODE_LEVEL_TITLES[savedDisguise] : 'Loading...';
            const disguiseFavicon = savedDisguise && FAVICON_MAP[savedDisguise] ? FAVICON_MAP[savedDisguise] : '';
            
            doc.open();
            let htmlContent = `<!DOCTYPE html><html><head><title>${disguiseTitle}</title>`;
            if (disguiseFavicon) {
              htmlContent += `<link rel="icon" href="${disguiseFavicon}">`;
            }
            htmlContent += `<script>window.addEventListener('message',function(e){if(!e.data||e.data.type!=='nexora:faviconChange'||!e.data.href)return;var old=document.querySelectorAll('link[rel~="icon"]');for(var i=0;i<old.length;i++)old[i].parentNode.removeChild(old[i]);var l=document.createElement('link');l.rel='icon';l.href=e.data.href;document.head.appendChild(l);});<\/script>`;
            htmlContent += '</head><body style="margin:0;padding:0;overflow:hidden;"></body></html>';
            doc.write(htmlContent);
            doc.close();

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
            iframe.name = 'nexora-cloaked';
            iframe.setAttribute('loading', 'eager');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            doc.body.appendChild(iframe);

            if (!window.opener) {
              window._aboutWin = win;
            }

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

            setTimeout(() => {
              window.location.replace(redirectUrl);
            }, 100);

          } catch (err) {

            win.close();
          }
        }
      }
    } catch (e) {

      
    }
  }

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
      const scheme = localStorage.getItem(SCHEME_KEY);
      
      if (theme) {
        const map = {
          'midnight-amber': 'theme-midnight-amber',
          'midnight-blueberry': 'theme-midnight-blueberry',
          'midnight-grape': 'theme-midnight-grape'
        };
        const cls = map[theme];
        if (cls) {
          document.documentElement.classList.remove(...Object.values(map));
          document.documentElement.classList.add(cls);
        }
      }

      if (scheme === 'light') {
        document.documentElement.classList.add('light-scheme');
      } else if (scheme === 'dark') {
        document.documentElement.classList.remove('light-scheme');
      }
    } catch (e) {}
  }

  function matchPerformancePreset(settings) {
    if (!settings) return null;
    for (const [presetName, presetSettings] of Object.entries(PERFORMANCE_PRESETS)) {
      if (
        presetSettings.mouseTracking === settings.mouseTracking &&
        presetSettings.animations === settings.animations &&
        presetSettings.glow === settings.glow &&
        presetSettings.blur === settings.blur &&
        presetSettings.transforms === settings.transforms
      ) {
        return presetName;
      }
    }
    return null;
  }

  function readPerformanceSettings() {
    let presetName = null;
    try {
      presetName = localStorage.getItem(PERFORMANCE_PRESET_KEY);
    } catch (e) {
      presetName = null;
    }

    if (presetName && PERFORMANCE_PRESETS[presetName]) {
      return { settings: PERFORMANCE_PRESETS[presetName], preset: presetName };
    }

    const fallbackSettings = {
      mouseTracking: JSON.parse(localStorage.getItem(MOUSE_TRACKING_KEY) || 'true'),
      animations: JSON.parse(localStorage.getItem(ANIMATIONS_KEY) || 'true'),
      glow: JSON.parse(localStorage.getItem(GLOW_KEY) || 'true'),
      blur: JSON.parse(localStorage.getItem(BLUR_KEY) || 'true'),
      transforms: JSON.parse(localStorage.getItem(TRANSFORMS_KEY) || 'true')
    };

    return { settings: fallbackSettings, preset: matchPerformancePreset(fallbackSettings) };
  }

  function applyPerformancePreferences() {
    try {
      const doc = document.documentElement;
      const { settings, preset } = readPerformanceSettings();

      doc.classList.toggle('performance-no-mouse-tracking', !settings.mouseTracking);
      doc.classList.toggle('performance-no-animations', !settings.animations);
      doc.classList.toggle('performance-no-glow', !settings.glow);
      doc.classList.toggle('performance-no-blur', !settings.blur);
      doc.classList.toggle('performance-no-transforms', !settings.transforms);
      doc.classList.toggle('performance-fast', (preset || matchPerformancePreset(settings)) === 'fast');
    } catch (e) {}
  }

  window.NexoraBoot = {
    applySavedTitle,
    applySavedFavicon,
    applySavedTheme,
    applyPerformancePreferences,
    setCookie,
    isInAboutBlank: isInAboutBlankIframe,
    syncDisguiseToParent
  };

  try {
    applySavedTitle();
    applySavedFavicon();
    applySavedTheme();
    applyPerformancePreferences();
    syncDisguiseToParent();
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncDisguiseToParent();
      if (window.NexoraSettings && typeof window.NexoraSettings.setFavicon === 'function') {
        try {
          const cookieFav = getCookie(COOKIE_FAV);
          const saved = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
          if (saved) window.NexoraSettings.setFavicon(saved).catch(()=>{});
        } catch (e) {}
      }
    }, { once: true });
  } else {
    syncDisguiseToParent();
    if (window.NexoraSettings && typeof window.NexoraSettings.setFavicon === 'function') {
      try {
        const cookieFav = getCookie(COOKIE_FAV);
        const saved = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
        if (saved) window.NexoraSettings.setFavicon(saved).catch(()=>{});
      } catch (e) {}
    }
  }

})();

// Favicon change → postMessage to parent frame
(function () {
  if (window.self === window.top) return;

  function postFaviconToParent(href) {
    try { window.parent.postMessage({ type: 'nexora:faviconChange', href: href }, '*'); } catch (e) {}
  }

  function startFaviconObserver() {
    var head = document.head;
    if (!head) return;
    var lastHref = '';

    var attrObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var el = m.target;
        if (el.tagName === 'LINK' && /\bicon\b/i.test(el.rel || '')) {
          var href = el.href;
          if (href && href !== lastHref) { lastHref = href; postFaviconToParent(href); }
        }
      });
    });

    function watchLink(link) {
      attrObserver.observe(link, { attributes: true, attributeFilter: ['href'] });
    }

    document.querySelectorAll('link[rel~="icon"]').forEach(watchLink);

    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && node.tagName === 'LINK' && /\bicon\b/i.test(node.rel || '')) {
            var href = node.href;
            if (href && href !== lastHref) { lastHref = href; postFaviconToParent(href); }
            watchLink(node);
          }
        });
      });
    }).observe(head, { childList: true });
  }

  if (document.head) {
    startFaviconObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startFaviconObserver, { once: true });
  }
})();

(function () {
  const PANIC_KEY_KEY = 'settings.panicKey';
  const PANIC_URL_KEY = 'settings.panicUrl';

  let isSettingPanicKey = false;

  function checkPanicKey(event) {

    if (isSettingPanicKey) return;

    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !target.readOnly) {
      return;
    }
    
    try {
      const savedKey = localStorage.getItem(PANIC_KEY_KEY);
      const savedUrl = localStorage.getItem(PANIC_URL_KEY);
      
      if (!savedKey || !savedUrl) return;

      const parts = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');
      
      const mainKey = event.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) {
        parts.push(mainKey === ' ' ? 'Space' : mainKey);
      }
      
      const currentCombo = parts.join(' + ');

      if (currentCombo === savedKey) {
        event.preventDefault();
        event.stopPropagation();

        window.open(savedUrl, '_blank');


        try {
          window.close();
        } catch (e) {

          window.location.href = 'about:blank';
        }
      }
    } catch (e) {
      
    }
  }

  document.addEventListener('keydown', checkPanicKey);

  window.NexoraPanicButton = {
    setIsSettingKey: function(value) {
      isSettingPanicKey = !!value;
    }
  };

  // =============================================
  // ANTI-INSPECT PROTECTION
  // =============================================

  // Disable on localhost for development
  const isLocalhost = window.location.hostname === '127.0.0.1' || 
                      window.location.hostname === 'localhost';

  if (!isLocalhost) {
    // Disable right-click context menu
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });

    // Disable keyboard shortcuts for dev tools
    document.addEventListener('keydown', function(e) {
      // Skip if setting panic key
      if (isSettingPanicKey) return;
      
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I (Inspect)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C (Element picker)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U (View source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
        e.preventDefault();
        return false;
      }
    });

    // Disable drag (prevents dragging images/links to inspect)
    document.addEventListener('dragstart', function(e) {
      e.preventDefault();
      return false;
    });
  }
})();

// Auto-register this domain in the Nexora Links directory
(function () {
  var REG_KEY = 'nexora.domain.registered';
  try {
    if (localStorage.getItem(REG_KEY)) return;
    var origin = location.origin;
    if (!origin || origin === 'null' || location.protocol !== 'https:') return;
    localStorage.setItem(REG_KEY, '1');
    fetch('https://2zpvhn3woh.execute-api.us-east-2.amazonaws.com/links/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: origin })
    }).catch(function () {});
  } catch (e) {}
})();

