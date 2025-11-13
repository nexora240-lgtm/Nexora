(function () {
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

  const DEFAULT_THEME_ID = 'midnight-amber';
  const THEME_KEY = 'settings.theme';
  const SCHEME_KEY = 'settings.colorScheme';
  const ABOUT_KEY = 'settings.aboutBlank';
  const DISGUISE_KEY = 'settings.disguise';
  const FAVICON_KEY = 'settings.faviconData';
  const CUSTOM_TITLE_KEY = 'settings.customTitle';
  const PANIC_KEY_KEY = 'settings.panicKey';
  const PANIC_URL_KEY = 'settings.panicUrl';
  const THEME_CLASS_MAP = {
    'midnight-amber': 'theme-midnight-amber',
    'midnight-blueberry': 'theme-midnight-blueberry',
    'midnight-grape': 'theme-midnight-grape'
  };

  const COOKIE_NAME = 'nexora_disguise';
  const COOKIE_FAV = 'nexora_favicon';
  const COOKIE_MAX_DAYS = 365;

  const FALLBACK_NONE_FAVICON = '/assets/logos/nexora-amber.png';

  const root = document.getElementById('settingsRoot');
  if (!root) return;
  const tabs = Array.from(root.querySelectorAll('.nav-btn'));
  const panels = {
    appearance: root.querySelector('#appearance'),
    cloaking: root.querySelector('#cloaking'),
    legal: root.querySelector('#legal'),
    misc: root.querySelector('#misc')
  };
  const schemeToggle = root.querySelector('#schemeToggle');
  const schemeInput = root.querySelector('#schemeToggleInput');
  const schemeLabel = root.querySelector('#schemeLabel');
  const aboutToggle = root.querySelector('#aboutToggle');
  const aboutInput = root.querySelector('#aboutToggleInput');
  const autoCloakStatus = root.querySelector('#auto-cloak-status');
  const disguiseSelect = root.querySelector('#disguiseSelect');
  const disguiseBadge = document.getElementById('disguise-badge');
  const disguiseTitle = document.getElementById('disguise-title');
  const disguiseSub = document.getElementById('disguise-sub');
  let faviconPreview = document.getElementById('disguise-favicon-preview');
  const disguiseLockedNote = document.getElementById('disguise-locked-note');
  const downloadBtn = root.querySelector('#downloadCookie');
  const uploadBtn = root.querySelector('#uploadCookie');
  const panicKeyInput = root.querySelector('#panicKeyInput');
  const panicUrlInput = root.querySelector('#panicUrlInput');
  const clearPanicKeyBtn = root.querySelector('#clearPanicKey');
  const panicStatus = root.querySelector('#panic-status');
  const panicKeyDisplay = root.querySelector('#panic-key-display');

  if (disguiseBadge && disguiseBadge.parentNode) {
    disguiseBadge.parentNode.removeChild(disguiseBadge);
  }

  if (!faviconPreview) {
    const preview = document.createElement('div');
    preview.id = 'disguise-favicon-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.style.width = '40px';
    preview.style.height = '40px';
    preview.style.borderRadius = '6px';
    preview.style.background = '#eee';
    preview.style.overflow = 'hidden';
    preview.style.display = 'inline-block';
    preview.style.verticalAlign = 'middle';
    const container = document.getElementById('disguise-preview') || root;
    container.insertBefore(preview, container.firstChild);
    faviconPreview = preview;
  }

  const original = {
    title: document.title,
    faviconHref: (document.getElementById('page-favicon') || document.querySelector('link[rel~="icon"]'))?.href || ''
  };

  const FAVICON_MAP = {
    "Clever": "/assets/favicon/clever.ico",
    "Google Classroom": "/assets/favicon/classroom.ico",
    "Canvas": "/assets/favicon/canvas.png",
    "Google Drive": "/assets/favicon/drive.png",
    "Seesaw": "/assets/favicon/seesaw.jpg",
    "Edpuzzle": "/assets/favicon/edpuzzle.png",
    "Kahoot!": "/assets/favicon/kahoot.ico",
    "Quizlet": "/assets/favicon/quizlet.png",
    "Khan Academy": "/assets/favicon/khanacademy.ico"
  };

  const BRAND_LOGOS = {
    "Clever": { title: "Clever | Portal", subtitle: "Single sign-on portal connecting students to all their digital learning tools." },
    "Google Classroom": { title: "Google Classroom", subtitle: "Streamlines assignments, classroom organization, and class communication." },
    "Canvas": { title: "Canvas", subtitle: "Robust learning management system used by schools and universities for assignments and grading." },
    "Google Drive": { title: "Google Drive", subtitle: "Cloud storage and file collaboration from Google Workspace." },
    "Seesaw": { title: "Seesaw", subtitle: "Student-driven digital portfolios and simple classroom tools for engagement." },
    "Edpuzzle": { title: "Edpuzzle", subtitle: "Interactive video lessons with embedded questions and usage reports." },
    "Kahoot!": { title: "Kahoot!", subtitle: "Game-based learning platform for quizzes, surveys, and interactive lessons." },
    "Quizlet": { title: "Quizlet", subtitle: "Study tools and flashcards to help learners prepare and remember material." },
    "Khan Academy": { title: "Khan Academy", subtitle: "Free, world-class education in many subjects with practice exercises and videos." }
  };

  function slugify(name) {
    return String(name || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  }
  function assetFor(name) {
    const s = slugify(name);
    return s ? `/assets/favicon/${s}.png` : '';
  }
  function encodeSvgToDataUrl(svg) {
    if (!svg) return '';
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    svg = svg.replace(/(href|xlink:href)=["']http[^"']*["']/g, '');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function removeAllFavicons() {
    Array.from(document.querySelectorAll('link[rel~="icon"]')).forEach(el => el.remove());
  }

  function setCookie(name, value, days = COOKIE_MAX_DAYS, domain = '') {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
      if (domain) cookie += '; domain=' + domain;
      if (location.protocol === 'https:') cookie += '; Secure';
      document.cookie = cookie;
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      const m = document.cookie.match('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  function resolveFaviconSource(name) {
    const explicit = FAVICON_MAP && FAVICON_MAP[name];
    if (explicit) return explicit;
    const local = assetFor(name);
    if (local) return local;
    return FALLBACK_NONE_FAVICON;
  }

  let _favToken = 0;
  let _lastBlobUrl = null;
  function revokeLastBlob() { try { if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; } } catch (e) {} }

  async function setFaviconFlexible(source) {
    const token = ++_favToken;

    if (!source) {
      try { localStorage.setItem(FAVICON_KEY, FALLBACK_NONE_FAVICON); setCookie(COOKIE_FAV, FALLBACK_NONE_FAVICON); } catch (e) {}
      revokeLastBlob(); removeAllFavicons();
      const link = document.createElement('link'); link.rel = 'icon'; link.href = FALLBACK_NONE_FAVICON; document.head.appendChild(link);
      updateFaviconPreview(FALLBACK_NONE_FAVICON);
      return true;
    }

    if (typeof source === 'string' && source.trim().startsWith('<svg')) {
      const dataUrl = encodeSvgToDataUrl(source);
      try { localStorage.setItem(FAVICON_KEY, dataUrl); setCookie(COOKIE_FAV, dataUrl); } catch (e) {}
      if (token !== _favToken) return false;
      revokeLastBlob(); removeAllFavicons();
      const link = document.createElement('link'); link.rel = 'icon'; link.type = 'image/svg+xml'; link.href = dataUrl; document.head.appendChild(link);
      updateFaviconPreview(dataUrl);
      return true;
    }

    if (typeof source === 'string' && (/^data:image\//i.test(source) || source.startsWith('/'))) {
      try { localStorage.setItem(FAVICON_KEY, source); setCookie(COOKIE_FAV, source); } catch (e) {}
      if (token !== _favToken) return false;
      revokeLastBlob(); removeAllFavicons();
      const link = document.createElement('link'); link.rel = 'icon';
      if (/^data:image\/png/i.test(source)) link.type = 'image/png';
      else if (/^data:image\/svg/i.test(source)) link.type = 'image/svg+xml';
      else link.type = 'image/png';
      link.href = source; document.head.appendChild(link);
      updateFaviconPreview(source);
      return true;
    }

    if (typeof source === 'string' && /^https?:\/\//i.test(source)) {
      const sep = source.includes('?') ? '&' : '?';
      const persistedHref = source + sep + '_n=' + Date.now();
      try {
        const res = await fetch(source, { mode: 'cors', cache: 'no-store' });
        if (token !== _favToken) return false;
        if (!res.ok) throw new Error('Fetch failed ' + res.status);
        const blob = await res.blob();
        if (token !== _favToken) return false;
        revokeLastBlob();
        const blobUrl = URL.createObjectURL(blob);
        _lastBlobUrl = blobUrl;
        try { localStorage.setItem(FAVICON_KEY, persistedHref); setCookie(COOKIE_FAV, persistedHref); } catch (e) {}
        removeAllFavicons();
        const link = document.createElement('link'); link.rel = 'icon'; if (blob.type) link.type = blob.type; link.href = blobUrl; document.head.appendChild(link);
        updateFaviconPreview(blobUrl);
        return true;
      } catch (err) {
        if (token !== _favToken) return false;
        revokeLastBlob(); removeAllFavicons();
        const link = document.createElement('link'); link.rel = 'icon'; link.href = persistedHref; document.head.appendChild(link);
        try { localStorage.setItem(FAVICON_KEY, persistedHref); setCookie(COOKIE_FAV, persistedHref); } catch (e) {}
        updateFaviconPreview(persistedHref);
        return true;
      }
    }

    try { localStorage.setItem(FAVICON_KEY, FALLBACK_NONE_FAVICON); setCookie(COOKIE_FAV, FALLBACK_NONE_FAVICON); } catch (e) {}
    revokeLastBlob(); removeAllFavicons();
    const link = document.createElement('link'); link.rel = 'icon'; link.href = FALLBACK_NONE_FAVICON; document.head.appendChild(link);
    updateFaviconPreview(FALLBACK_NONE_FAVICON);
    return true;
  }

  function updateFaviconPreview(src) {
    if (!faviconPreview) return;
    while (faviconPreview.firstChild) faviconPreview.removeChild(faviconPreview.firstChild);
    faviconPreview.style.background = '#ddd';
    faviconPreview.style.width = '40px';
    faviconPreview.style.height = '40px';
    faviconPreview.style.borderRadius = '6px';
    faviconPreview.setAttribute('aria-hidden', 'true');

    if (!src) return;
    const img = document.createElement('img');
    img.className = 'favicon-thumb';
    img.alt = 'favicon preview';
    img.src = src;
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.style.display = 'block';
    faviconPreview.style.background = 'transparent';
    img.onerror = function () {
      if (img.parentNode) img.parentNode.removeChild(img);
      faviconPreview.style.background = '#ddd';
      faviconPreview.setAttribute('aria-hidden', 'true');
    };
    img.onload = function () { faviconPreview.setAttribute('aria-hidden', 'false'); };
    faviconPreview.appendChild(img);
  }

  async function restoreOriginalAppearance() {
    const cookieDisguise = getCookie(COOKIE_NAME);
    const savedUserCustom = localStorage.getItem(CUSTOM_TITLE_KEY);
    if (savedUserCustom) document.title = savedUserCustom;
    else {
      const savedDisguise = cookieDisguise || localStorage.getItem(DISGUISE_KEY) || '';
      if (savedDisguise && CODE_LEVEL_TITLES[savedDisguise]) document.title = CODE_LEVEL_TITLES[savedDisguise];
      else document.title = original.title || '';
    }

    const cookieFav = getCookie(COOKIE_FAV);
    const savedFavicon = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
    if (savedFavicon) {
      try { await setFaviconFlexible(savedFavicon); } catch (e) { updateFaviconPreview(savedFavicon); }
    } else if (original.faviconHref) {
      try { await setFaviconFlexible(original.faviconHref); } catch (e) { updateFaviconPreview(original.faviconHref); }
    } else {
      updateFaviconPreview(FALLBACK_NONE_FAVICON);
    }
  }

  async function applyDisguiseToTab(disguiseName, arg2, arg3) {
    let overrideTitle, cb;
    if (typeof arg2 === 'function') { cb = arg2; overrideTitle = undefined; }
    else { overrideTitle = arg2; cb = arg3; }

    const name = (disguiseName || '').trim();
    if (!name) {
      await restoreOriginalAppearance();
      if (typeof cb === 'function') cb(true);
      return;
    }

    const brand = BRAND_LOGOS[name] || {};
    const savedUserCustom = localStorage.getItem(CUSTOM_TITLE_KEY);
    const codeTitle = CODE_LEVEL_TITLES[name];
    const chosenTitle = (typeof overrideTitle === 'string' && overrideTitle.trim()) ? overrideTitle.trim()
                       : (savedUserCustom ? savedUserCustom
                       : (codeTitle ? codeTitle
                       : (brand && brand.title ? brand.title : name)));
    if (chosenTitle) document.title = chosenTitle;

    const explicit = FAVICON_MAP && FAVICON_MAP[name];
    const source = explicit || assetFor(name) || FALLBACK_NONE_FAVICON;

    try { localStorage.setItem(DISGUISE_KEY, name); } catch (e) {}
    setCookie(COOKIE_NAME, name);

    updateFaviconPreview(source);
    await setFaviconFlexible(source);

    if (typeof cb === 'function') cb(true);
  }

  function applyDisguisePreview(disguiseName, emit = true) {
    const choice = (disguiseName || '').trim();
    try { localStorage.setItem(DISGUISE_KEY, choice); } catch (e) {}
    setCookie(COOKIE_NAME, choice);

    if (!choice) {
      if (disguiseTitle) disguiseTitle.textContent = 'No disguise';
      if (disguiseSub) disguiseSub.textContent = 'Your tab will keep the current title and favicon.';
      updateFaviconPreview(FALLBACK_NONE_FAVICON);
      if (emit) document.dispatchEvent(new CustomEvent('settings:disguiseChanged', { detail: { disguise: choice } }));
      return;
    }

    const brand = BRAND_LOGOS[choice] || {};
    if (brand.svg && typeof brand.svg === 'string' && brand.svg.trim().startsWith('<svg')) {
    }

    if (disguiseTitle) disguiseTitle.textContent = brand.title || choice;
    if (disguiseSub) disguiseSub.textContent = brand.subtitle || '';

    const explicit = FAVICON_MAP && FAVICON_MAP[choice];
    const previewSource = explicit || assetFor(choice) || FALLBACK_NONE_FAVICON;
    if (previewSource && typeof previewSource === 'string' && previewSource.trim().startsWith('<svg')) {
      updateFaviconPreview(encodeSvgToDataUrl(previewSource));
    } else {
      updateFaviconPreview(previewSource);
    }

    if (emit) document.dispatchEvent(new CustomEvent('settings:disguiseChanged', { detail: { disguise: choice } }));
  }

  function activate(section) {
    tabs.forEach(t => {
      const active = t.dataset.target === section;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Object.keys(panels).forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      const show = key === section;
      panel.hidden = !show;
      panel.setAttribute('aria-hidden', !show);
    });
  }
  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.target)));

  function ensureThemeClassExists() {
    if (!document.documentElement.classList.contains('theme-midnight-amber') &&
        !document.documentElement.classList.contains('theme-midnight-blueberry') &&
        !document.documentElement.classList.contains('theme-midnight-grape')) {
      document.documentElement.classList.add(THEME_CLASS_MAP[DEFAULT_THEME_ID]);
    }
  }
  function applyScheme(scheme, emit = true) {
    if (scheme === 'dark') {
      document.documentElement.classList.remove('light-scheme');
      ensureThemeClassExists();
      if (schemeInput) schemeInput.checked = true;
      schemeToggle?.classList.add('active');
      schemeToggle?.setAttribute('aria-checked', 'true');
      if (schemeLabel) schemeLabel.textContent = 'Dark Mode';
    } else {
      // Get current theme before adding light-scheme
      const savedTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME_ID;
      const themeClass = THEME_CLASS_MAP[savedTheme] || THEME_CLASS_MAP[DEFAULT_THEME_ID];
      
      document.documentElement.classList.add('light-scheme');
      // Keep the theme class for color variation in light mode
      document.documentElement.classList.remove(...Object.values(THEME_CLASS_MAP));
      document.documentElement.classList.add(themeClass);
      
      if (schemeInput) schemeInput.checked = false;
      schemeToggle?.classList.remove('active');
      schemeToggle?.setAttribute('aria-checked', 'false');
      if (schemeLabel) schemeLabel.textContent = 'Light Mode';
    }
    try { localStorage.setItem(SCHEME_KEY, scheme); } catch (e) {}
    if (emit) document.dispatchEvent(new CustomEvent('settings:colorSchemeChanged', { detail: { scheme } }));
  }
  if (schemeToggle) {
    schemeToggle.addEventListener('click', () => {
      const next = schemeInput && schemeInput.checked ? 'light' : 'dark';
      applyScheme(next);
    });
    schemeToggle.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        const next = schemeInput && schemeInput.checked ? 'light' : 'dark';
        applyScheme(next);
      }
    });
  }

  function clearThemeOptionSelection() {
    root.querySelectorAll('.theme-option.selected').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
  }
  function applyTheme(themeId, emit = true) {
    if (!themeId) return;
    const cls = THEME_CLASS_MAP[themeId] || THEME_CLASS_MAP[DEFAULT_THEME_ID];
    const isLight = document.documentElement.classList.contains('light-scheme');
    document.documentElement.classList.remove(...Object.values(THEME_CLASS_MAP));
    // Always add the theme class for color variation (works in both light and dark)
    document.documentElement.classList.add(cls);
    try { localStorage.setItem(THEME_KEY, themeId); } catch (e) {}
    if (emit) document.dispatchEvent(new CustomEvent('settings:themeChanged', { detail: { theme: themeId } }));
  }
  root.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => { clearThemeOptionSelection(); btn.classList.add('selected'); btn.setAttribute('aria-pressed', 'true'); applyTheme(btn.dataset.value); });
  });

  function setAboutState(enabled, emitEvent = true) {
    if (!aboutToggle || !aboutInput) return;
    aboutInput.checked = !!enabled;
    aboutToggle.classList.toggle('active', !!enabled);
    aboutToggle.setAttribute('aria-checked', !!enabled ? 'true' : 'false');
    try { localStorage.setItem(ABOUT_KEY, JSON.stringify(!!enabled)); } catch (e) {}
    if (emitEvent) document.dispatchEvent(new CustomEvent('settings:aboutBlankToggled', { detail: { enabled: !!enabled } }));

    if (!!enabled) {
      if (disguiseSelect) disguiseSelect.classList.add('locked');
      if (disguiseLockedNote) { disguiseLockedNote.style.display = 'block'; disguiseLockedNote.setAttribute('aria-hidden', 'false'); }
      if (autoCloakStatus) { autoCloakStatus.style.display = 'block'; }
    } else {
      if (disguiseSelect) disguiseSelect.classList.remove('locked');
      if (disguiseLockedNote) { disguiseLockedNote.style.display = 'none'; disguiseLockedNote.setAttribute('aria-hidden', 'true'); }
      if (autoCloakStatus) { autoCloakStatus.style.display = 'none'; }
    }

    // Don't automatically open window when toggling in settings
    // The auto-cloaking will happen on next page load via nexora-boot.js
    try {
      if (!enabled) {
        // If disabling, close any existing about:blank window and redirect to original URL
        if (_aboutWin && !_aboutWin.closed) {
          try { 
            _aboutWin.close();
            // Redirect current window back to the original URL
            if (window.opener) {
              window.location.href = window.location.origin;
            }
          } catch (e) {}
        }
        _aboutWin = null;
      }
    } catch (e) {
    }
  }
  if (aboutToggle) {
    aboutToggle.addEventListener('click', () => setAboutState(!aboutInput.checked));
    aboutToggle.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setAboutState(!aboutInput.checked); }});
  }

  if (disguiseSelect) {
    disguiseSelect.addEventListener('change', () => {
      const val = disguiseSelect.value || '';
      applyDisguisePreview(val, true);
      if (val) applyDisguiseToTab(val);
      else {
        restoreOriginalAppearance();
        try { localStorage.setItem(FAVICON_KEY, FALLBACK_NONE_FAVICON); setCookie(COOKIE_FAV, FALLBACK_NONE_FAVICON); } catch (e) {}
        setTimeout(() => { setFaviconFlexible(FALLBACK_NONE_FAVICON); }, 0);
      }
    });
  }

  function exportSettings() {
    try {
      const exportObj = { exportedAt: new Date().toISOString(), settings: {} };
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('settings.')) { try { exportObj.settings[key] = localStorage.getItem(key); } catch (e) {} }
      }
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `nexora-cookies-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {}
  }
  function importSettingsFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const text = String(ev.target.result || '');
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.settings || typeof parsed.settings !== 'object') throw new Error('Invalid settings file format');
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && key.startsWith('settings.')) toRemove.push(key); }
        toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
        Object.keys(parsed.settings).forEach(k => { if (typeof k !== 'string' || !k.startsWith('settings.')) return; const v = parsed.settings[k]; try { localStorage.setItem(k, String(v)); } catch (e) {} });
        restoreSettingsUI();
        document.dispatchEvent(new CustomEvent('settings:imported', { detail: { sourceFile: file.name } }));
      } catch (err) { try { alert('Failed to import settings: invalid file.'); } catch (e) {} }
    };
    reader.onerror = function () {};
    reader.readAsText(file);
  }
  function openFilePickerAndImport() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.style.display = 'none';
    input.addEventListener('change', () => { const f = input.files && input.files[0]; if (f) importSettingsFile(f); input.remove(); }, { once: true });
    document.body.appendChild(input); input.click();
  }
  downloadBtn?.addEventListener('click', (e) => { e.preventDefault(); exportSettings(); });
  uploadBtn?.addEventListener('click', (e) => { e.preventDefault(); openFilePickerAndImport(); });

  async function restoreSettingsUI() {
    try {
      const savedScheme = localStorage.getItem(SCHEME_KEY);
      if (savedScheme === 'light' || savedScheme === 'dark') applyScheme(savedScheme, false); else applyScheme('dark', false);

      clearThemeOptionSelection();
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme && root.querySelector(`.theme-option[data-value="${savedTheme}"]`)) {
        const btn = root.querySelector(`.theme-option[data-value="${savedTheme}"]`);
        btn.classList.add('selected'); btn.setAttribute('aria-pressed', 'true'); applyTheme(savedTheme, false);
      } else {
        const defaultBtn = root.querySelector(`.theme-option[data-value="${DEFAULT_THEME_ID}"]`);
        if (defaultBtn) { defaultBtn.classList.add('selected'); defaultBtn.setAttribute('aria-pressed', 'true'); }
        applyTheme(DEFAULT_THEME_ID, false);
      }

      const savedAbout = JSON.parse(localStorage.getItem(ABOUT_KEY) || 'false');
      setAboutState(Boolean(savedAbout), false);

      const cookieDisguise = getCookie(COOKIE_NAME);
      const savedDisguise = cookieDisguise || localStorage.getItem(DISGUISE_KEY) || '';
      if (savedDisguise && disguiseSelect) {
        const opt = Array.from(disguiseSelect.options).find(o => o.value === savedDisguise || o.text === savedDisguise);
        if (opt) disguiseSelect.value = opt.value;
      }

      const savedCustomTitle = localStorage.getItem(CUSTOM_TITLE_KEY) || '';
      const inputEl = document.getElementById('customTitleInput');
      if (inputEl) inputEl.value = savedCustomTitle;

      const cookieFav = getCookie(COOKIE_FAV);
      const savedFavicon = cookieFav || localStorage.getItem(FAVICON_KEY) || '';
      if (savedFavicon) { try { await setFaviconFlexible(savedFavicon); } catch (e) { updateFaviconPreview(savedFavicon); } }
      else if (original.faviconHref) updateFaviconPreview(original.faviconHref);
      else updateFaviconPreview(FALLBACK_NONE_FAVICON);

      applyDisguisePreview(savedDisguise || '', false);
    } catch (e) {}
  }

  // === Panic Button Functionality ===
  
  let currentPanicKey = null;

  function formatKeyCombo(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    // Add the main key
    const mainKey = event.key;
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) {
      parts.push(mainKey === ' ' ? 'Space' : mainKey);
    }
    
    return parts.join(' + ');
  }

  function savePanicSettings(keyCombo, url) {
    try {
      if (keyCombo) localStorage.setItem(PANIC_KEY_KEY, keyCombo);
      else localStorage.removeItem(PANIC_KEY_KEY);
      
      if (url) localStorage.setItem(PANIC_URL_KEY, url);
      else localStorage.removeItem(PANIC_URL_KEY);
    } catch (e) {
      console.error('Failed to save panic settings:', e);
    }
  }

  function updatePanicStatus() {
    const keyCombo = currentPanicKey;
    const url = panicUrlInput ? panicUrlInput.value.trim() : '';
    
    if (keyCombo && url && panicStatus && panicKeyDisplay) {
      panicKeyDisplay.textContent = keyCombo;
      panicStatus.style.display = 'block';
    } else if (panicStatus) {
      panicStatus.style.display = 'none';
    }
  }

  function handlePanicKeyInput(event) {
    event.preventDefault();
    
    // Ignore modifier-only keys
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      return;
    }
    
    const keyCombo = formatKeyCombo(event);
    currentPanicKey = keyCombo;
    
    if (panicKeyInput) {
      panicKeyInput.value = keyCombo;
    }
    
    const url = panicUrlInput ? panicUrlInput.value.trim() : '';
    savePanicSettings(keyCombo, url);
    updatePanicStatus();
    
    // Re-enable panic button after setting key
    if (window.NexoraPanicButton) {
      window.NexoraPanicButton.setIsSettingKey(false);
    }
  }

  function clearPanicKey() {
    currentPanicKey = null;
    if (panicKeyInput) {
      panicKeyInput.value = '';
    }
    savePanicSettings(null, panicUrlInput ? panicUrlInput.value.trim() : '');
    updatePanicStatus();
  }

  function handlePanicUrlChange() {
    const url = panicUrlInput ? panicUrlInput.value.trim() : '';
    savePanicSettings(currentPanicKey, url);
    updatePanicStatus();
  }

  function initPanicButton() {
    try {
      // Restore saved settings
      const savedKey = localStorage.getItem(PANIC_KEY_KEY);
      const savedUrl = localStorage.getItem(PANIC_URL_KEY);
      
      if (savedKey) {
        currentPanicKey = savedKey;
        if (panicKeyInput) panicKeyInput.value = savedKey;
      }
      
      if (savedUrl && panicUrlInput) {
        panicUrlInput.value = savedUrl;
      }
      
      updatePanicStatus();
      
      // Set up event listeners
      if (panicKeyInput) {
        panicKeyInput.addEventListener('keydown', handlePanicKeyInput);
        panicKeyInput.addEventListener('click', () => {
          // Disable panic button while setting key
          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(true);
          }
          panicKeyInput.value = 'Press a key...';
        });
        panicKeyInput.addEventListener('blur', () => {
          // Re-enable panic button when input loses focus
          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(false);
          }
          if (panicKeyInput.value === 'Press a key...') {
            panicKeyInput.value = currentPanicKey || '';
          }
        });
      }
      
      if (clearPanicKeyBtn) {
        clearPanicKeyBtn.addEventListener('click', clearPanicKey);
      }
      
      if (panicUrlInput) {
        panicUrlInput.addEventListener('input', handlePanicUrlChange);
        panicUrlInput.addEventListener('change', handlePanicUrlChange);
      }
    } catch (e) {
      console.error('Failed to initialize panic button:', e);
    }
  }

  // === End Panic Button ===

  activate('appearance');
  try { restoreSettingsUI(); } catch (e) {}
  initPanicButton();

  window.NexoraSettings = {
    applyTheme,
    applyScheme,
    setAboutState,
    exportSettings,
    importSettingsFile,
    applyDisguisePreview,
    applyDisguiseToTab,
    setFavicon: setFaviconFlexible,
    restoreOriginalAppearance
  };

})();

(function () {
  if (!window._aboutWin) window._aboutWin = null;

  function getCurrentOrigin() {
    const o = window.location.origin || (window.location.protocol + '//' + window.location.host);
    return o.replace(/\/$/, '');
  }

  function openGameSimpleLocal(url) {
    const target = (url && url.length) ? String(url).replace(/\/$/, '') : getCurrentOrigin();
    try {
      const win = window.open();
      if (!win) return null;
      try {
        if (!win.document.body) win.document.documentElement.appendChild(win.document.createElement('body'));
        const iframe = win.document.createElement('iframe');
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.margin = "0";
        iframe.style.padding = "0";
        iframe.style.position = "absolute";
        iframe.style.top = "0";
        iframe.style.left = "0";
        iframe.src = target;
        iframe.setAttribute('loading', 'eager');
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        win.document.body.style.margin = "0";
        win.document.body.style.padding = "0";
        win.document.body.style.overflow = "hidden";
        win.document.body.appendChild(iframe);
      } catch (innerErr) {
        try { win.location.href = target; } catch (navErr) {}
      }
      return win;
    } catch (err) {
      return null;
    }
  }

  if (!window.openGameSimple) window.openGameSimple = openGameSimpleLocal;

  document.addEventListener('settings:aboutBlankToggled', function (e) {
    try {
      const enabled = !!(e && e.detail && e.detail.enabled);

      if (enabled) {
        if (window._aboutWin && !window._aboutWin.closed) {
          try { window._aboutWin.focus(); } catch (err) {}
          return;
        }

        const openedBySettings = window._aboutWin && !window._aboutWin.closed;
        if (!openedBySettings) {
          const w = (typeof window.openGameSimple === 'function') ? window.openGameSimple() : openGameSimpleLocal();
          if (w) window._aboutWin = w;
        }
      } else {
        if (window._aboutWin && !window._aboutWin.closed) {
          try { window._aboutWin.close(); } catch (err) {}
        }
        window._aboutWin = null;
      }
    } catch (err) {}
  }, false);

  function openGame() {
    var win = window.open();
    var url = getCurrentOrigin();
    try {
      var iframe = win.document.createElement('iframe');
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.src = url;
      win.document.body.appendChild(iframe);
    } catch (e) {
      try { win.location.href = url; } catch (e) {}
    }
    return win;
  }

  window.openGame = openGame;

})();

(function () {
  const LOGO_MAP = {
    'midnight-amber': '/assets/logos/nexora-amber.png',
    'midnight-blueberry': '/assets/logos/nexora-blueberry.png',
    'midnight-grape': '/assets/logos/nexora-grape.png'
  };

  const FAVICON_MAP = {
    'midnight-amber': 'assets/favicon-amber.png',
    'midnight-blueberry': 'assets/favicon-blueberry.png',
    'midnight-grape': 'assets/favicon-grape.png'
  };

  const DEFAULT_LOGO = '/assets/logos/nexora-amber.png';
  const DEFAULT_FAVICON = 'assets/favicon-amber.png';

  function setLogoAndFaviconForTheme(themeId) {
    const isLight = document.documentElement.classList.contains('light-scheme');
    
    let logo, favicon;
    
    if (isLight) {
      logo = DEFAULT_LOGO;
      favicon = DEFAULT_FAVICON;
    } else {
      logo = (themeId && LOGO_MAP[themeId]) ? LOGO_MAP[themeId] : DEFAULT_LOGO;
      favicon = (themeId && FAVICON_MAP[themeId]) ? FAVICON_MAP[themeId] : DEFAULT_FAVICON;
    }

    try {
      const localSidebarImg = document.querySelector('.sidebar-title img') || document.querySelector('img[alt="Nexora Logo"]');
      if (localSidebarImg && localSidebarImg.src.indexOf(logo) === -1) {
        localSidebarImg.src = logo;
      }

      const localFavicon = document.getElementById('favicon');
      if (localFavicon && localFavicon.href.indexOf(favicon) === -1) {
        localFavicon.href = favicon;
      }

      try {
        if (window.opener && !window.opener.closed && window.opener.document) {
          const opImg = window.opener.document.querySelector('.sidebar-title img') || window.opener.document.querySelector('img[alt="Nexora Logo"]');
          if (opImg && opImg.src.indexOf(logo) === -1) {
            opImg.src = logo;
          }

          const opFavicon = window.opener.document.getElementById('favicon');
          if (opFavicon && opFavicon.href.indexOf(favicon) === -1) {
            opFavicon.href = favicon;
          }
        }
      } catch (e) {
      }
    } catch (err) {
    }
  }

  function getSavedTheme() {
    try { return localStorage.getItem('settings.theme'); } catch (e) { return null; }
  }

  document.addEventListener('settings:themeChanged', function (e) {
    try {
      const theme = e && e.detail && e.detail.theme;
      setLogoAndFaviconForTheme(theme);
    } catch (err) {}
  }, false);

  document.addEventListener('settings:colorSchemeChanged', function (e) {
    try {
      const saved = getSavedTheme();
      setLogoAndFaviconForTheme(saved);
    } catch (err) {}
  }, false);

  function init() {
    const classList = document.documentElement.classList;
    let currentTheme = null;
    
    if (classList.contains('theme-midnight-amber')) {
      currentTheme = 'midnight-amber';
    } else if (classList.contains('theme-midnight-blueberry')) {
      currentTheme = 'midnight-blueberry';
    } else if (classList.contains('theme-midnight-grape')) {
      currentTheme = 'midnight-grape';
    }
    
    if (!currentTheme) {
      currentTheme = getSavedTheme();
    }
    
    setLogoAndFaviconForTheme(currentTheme || 'midnight-amber');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();