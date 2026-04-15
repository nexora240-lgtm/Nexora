(function () {
  'use strict';

  /*  Constants  */
  const FIRST_VISIT_KEY = 'nexora_hasVisited';
  const DISGUISE_KEY = 'settings.disguise';
  const FAVICON_KEY = 'settings.faviconData';
  const ABOUT_KEY = 'settings.aboutBlank';
  const COOKIE_CONSENT_KEY = 'nexora_cookieConsent';
  const COOKIE_NAME = 'nexora_disguise';
  const COOKIE_FAV = 'nexora_favicon';
  const COOKIE_MAX_DAYS = 365;
  const PANIC_KEY_KEY = 'settings.panicKey';
  const PANIC_URL_KEY = 'settings.panicUrl';

  const DISGUISE_OPTIONS = [
    { name: "Clever",           title: "Clever | Portal",           icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/clever.ico" },
    { name: "Google Classroom", title: "Home",                      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/classroom.ico" },
    { name: "Canvas",           title: "Dashboard",                 icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/canvas.png" },
    { name: "Google Drive",     title: "Home - Google Drive",       icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/drive.png" },
    { name: "Seesaw",           title: "Seesaw",                    icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/seesaw.jpg" },
    { name: "Edpuzzle",         title: "Edpuzzle",                  icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/edpuzzle.png" },
    { name: "Kahoot!",          title: "Enter Game PIN - Kahoot!",  icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/kahoot.ico" },
    { name: "Quizlet",          title: "Your Sets | Quizlet",       icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/quizlet.png" },
    { name: "Khan Academy",     title: "Dashboard | Khan Academy",  icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/khanacademy.ico" }
  ];

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

  /* 4 setup steps: disguise, cloaking, panic, cookies */
  const TOTAL_STEPS = 4;

  /*  State  */
  let currentStep = 0;
  let selectedDisguise = null;
  let selectedCloakingOption = null;
  let selectedPanicKey = null;
  let panicUrlValue = '';
  let selectedCookieOption = null;
  let setupEl = null;
  let fillEl = null;
  let progressBarEl = null;
  let cardWrapper = null;
  let stepDots = [];

  /*  Helpers  */

  function bindMouseTracking(el) {
    if (!el || !window.NexoraMouseTracking) return;
    window.NexoraMouseTracking.bindElement(el);
  }

  function getCookie(name) {
    try {
      const m = document.cookie.match('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  function setCookie(name, value, days) {
    days = days || COOKIE_MAX_DAYS;
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      let c = encodeURIComponent(name) + '=' + encodeURIComponent(value) +
              '; expires=' + expires + '; path=/; SameSite=Lax';
      if (location.protocol === 'https:') c += '; Secure';
      document.cookie = c;
    } catch (e) {}
  }

  function isFirstVisit() {
    try { return !localStorage.getItem(FIRST_VISIT_KEY); }
    catch (e) { return false; }
  }

  function markAsVisited() {
    try { localStorage.setItem(FIRST_VISIT_KEY, 'true'); } catch (e) {}
  }

  function hasAccount() {
    try { return localStorage.getItem('nexora.auth.credentials') !== null; }
    catch (e) { return false; }
  }

  /*  Apply settings  */

  function applyDisguise(d) {
    if (!d) return;
    try {
      localStorage.setItem(DISGUISE_KEY, d.name);
      localStorage.setItem(FAVICON_KEY, d.icon);
      setCookie(COOKIE_NAME, d.name);
      setCookie(COOKIE_FAV, d.icon);
      document.title = d.title;
      document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = d.icon;
      if (d.icon.includes('.ico')) link.type = 'image/x-icon';
      else if (d.icon.includes('.png')) link.type = 'image/png';
      else if (d.icon.includes('.svg')) link.type = 'image/svg+xml';
      document.head.appendChild(link);
    } catch (e) {}
  }

  function applyCloakingSetting(enabled) {
    try { localStorage.setItem(ABOUT_KEY, JSON.stringify(!!enabled)); } catch (e) {}
  }

  function applyPanicSettings(key, url) {
    try {
      if (key && url) {
        localStorage.setItem(PANIC_KEY_KEY, key);
        localStorage.setItem(PANIC_URL_KEY, url);
      }
    } catch (e) {}
  }

  function applyCookieConsent(accepted) {
    try {
      if (accepted) {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      } else {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
        try {
          document.cookie.split(';').forEach(function (c) {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
          });
          const keep = [COOKIE_CONSENT_KEY, FIRST_VISIT_KEY];
          Object.keys(localStorage).forEach(k => { if (!keep.includes(k)) localStorage.removeItem(k); });
        } catch (e) {}
      }
    } catch (e) {}
  }

  /*  Progress / fill helpers  */

  function updateFill(step) {
    const pct = Math.min((step / TOTAL_STEPS) * 100, 100);
    if (fillEl) fillEl.style.height = pct + '%';
    if (progressBarEl) progressBarEl.style.width = pct + '%';
    stepDots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < step) dot.classList.add('done');
      else if (i === step) dot.classList.add('active');
    });
  }

  /*  Transition card helper  */

  function transitionCard(buildFn) {
    const card = cardWrapper.querySelector('.setup-card');
    if (card) {
      card.classList.add('card-exit');
      setTimeout(() => {
        cardWrapper.innerHTML = '';
        const newCard = buildFn();
        cardWrapper.appendChild(newCard);
        bindMouseTracking(newCard);
      }, 350);
    } else {
      cardWrapper.innerHTML = '';
      const newCard = buildFn();
      cardWrapper.appendChild(newCard);
      bindMouseTracking(newCard);
    }
  }

  /* 
     BUILD THE FULL-SCREEN SETUP SHELL
      */

  function buildSetupShell() {
    setupEl = document.createElement('div');
    setupEl.id = 'nexora-setup';

    // Background
    const bg = document.createElement('div');
    bg.className = 'setup-bg';

    // Water fill
    fillEl = document.createElement('div');
    fillEl.className = 'setup-fill';

    // Ambient orbs
    const orb1 = document.createElement('div');
    orb1.className = 'setup-orb setup-orb-1';
    const orb2 = document.createElement('div');
    orb2.className = 'setup-orb setup-orb-2';

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'setup-progress';
    progressBarEl = document.createElement('div');
    progressBarEl.className = 'setup-progress-bar';
    progress.appendChild(progressBarEl);

    // Step dots
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'setup-steps';
    stepDots = [];
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const dot = document.createElement('div');
      dot.className = 'setup-step-dot';
      dotsWrap.appendChild(dot);
      stepDots.push(dot);
    }

    // Card wrapper
    cardWrapper = document.createElement('div');
    cardWrapper.className = 'setup-card-wrapper';

    setupEl.appendChild(bg);
    setupEl.appendChild(fillEl);
    setupEl.appendChild(orb1);
    setupEl.appendChild(orb2);
    setupEl.appendChild(progress);
    setupEl.appendChild(dotsWrap);
    setupEl.appendChild(cardWrapper);

    document.body.appendChild(setupEl);
  }

  /* 
     WELCOME CHOICE (Login vs New Setup)  shown before shell
      */

  function showWelcomeChoice() {
    buildSetupShell();
    // Hide dots & progress for welcome
    setupEl.querySelector('.setup-steps').style.display = 'none';
    setupEl.querySelector('.setup-progress').style.display = 'none';
    fillEl.style.height = '0%';

    transitionCard(buildWelcomeCard);
  }

  function buildWelcomeCard() {
    const card = document.createElement('div');
    card.className = 'setup-card';
    card.innerHTML = `
      <h2>Welcome to Nexora</h2>
      <p class="subtitle">Already have an account? Log in to sync your stuff. New here? Let's get you set up.</p>
      <div class="setup-welcome-options">
        <div class="setup-welcome-opt" data-action="login">
          <h3>Log In</h3>
          <p>Sign in to sync settings across devices.</p>
        </div>
        <div class="setup-welcome-opt" data-action="setup">
          <h3>New Setup</h3>
          <p>First time? We'll walk you through it.</p>
        </div>
      </div>
    `;

    card.querySelector('[data-action="login"]').addEventListener('click', () => {
      transitionCard(buildLoginCard);
    });
    card.querySelector('[data-action="setup"]').addEventListener('click', () => {
      // Show dots & progress
      setupEl.querySelector('.setup-steps').style.display = '';
      setupEl.querySelector('.setup-progress').style.display = '';
      currentStep = 0;
      updateFill(0);
      goToStep(0);
    });

    return card;
  }

  /*  Login card  */

  function buildLoginCard() {
    const card = document.createElement('div');
    card.className = 'setup-card';
    card.innerHTML = `
      <h2>Log In</h2>
      <p class="subtitle">Sign in to sync your settings and progress.</p>
      <div class="setup-auth-form">
        <div>
          <label for="ftm-login-user">Username</label>
          <input id="ftm-login-user" type="text" placeholder="Enter your username" autocomplete="username" />
        </div>
        <div>
          <label for="ftm-login-pass">Password</label>
          <input id="ftm-login-pass" type="password" placeholder="Enter your password" autocomplete="current-password" />
        </div>
        <div class="setup-auth-error" id="ftm-login-error"></div>
      </div>
      <div class="setup-actions">
        <button class="setup-btn-secondary" id="ftm-login-back">Back</button>
        <button class="setup-btn-primary" id="ftm-login-submit">Log In</button>
      </div>
    `;

    setTimeout(() => {
      const backBtn = card.querySelector('#ftm-login-back');
      const submitBtn = card.querySelector('#ftm-login-submit');
      if (backBtn) backBtn.addEventListener('click', () => transitionCard(buildWelcomeCard));
      if (submitBtn) submitBtn.addEventListener('click', async () => {
        const user = document.getElementById('ftm-login-user').value.trim();
        const pass = document.getElementById('ftm-login-pass').value;
        const err = document.getElementById('ftm-login-error');
        if (!user || !pass) { err.textContent = 'Please enter username and password'; err.style.display = 'block'; return; }
        submitBtn.disabled = true; submitBtn.textContent = 'Logging in...';
        try {
          if (window.NexoraAuth) { await window.NexoraAuth.login(user, pass, true); }
          else throw new Error('Auth service not available');
        } catch (e) {
          err.textContent = e.message || 'Login failed'; err.style.display = 'block';
          submitBtn.disabled = false; submitBtn.textContent = 'Log In';
        }
      });
    }, 0);

    return card;
  }

  /* 
     STEP ROUTER
      */

  function goToStep(step) {
    currentStep = step;
    updateFill(step);
    switch (step) {
      case 0: transitionCard(buildDisguiseCard); break;
      case 1: transitionCard(buildCloakingCard); break;
      case 2: transitionCard(buildPanicCard); break;
      case 3: transitionCard(buildCookieCard); break;
      default: break;
    }
  }

  /* 
     STEP 0  DISGUISE
      */

  function buildDisguiseCard() {
    const card = document.createElement('div');
    card.className = 'setup-card';

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Pick your disguise</h2>
      <p class="subtitle">Changes what your browser tab looks like so nobody knows what you're up to.</p>
    `;

    const grid = document.createElement('div');
    grid.className = 'setup-disguise-grid';

    DISGUISE_OPTIONS.forEach(d => {
      const item = document.createElement('div');
      item.className = 'setup-disguise-item';
      if (selectedDisguise && selectedDisguise.name === d.name) item.classList.add('selected');
      item.innerHTML = `
        <div class="d-icon"><img src="${d.icon}" alt="${d.name}" onerror="this.style.display='none'"></div>
        <p class="d-name">${d.name}</p>
        <div class="d-check">\u2713</div>
      `;
      item.addEventListener('click', () => {
        grid.querySelectorAll('.setup-disguise-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedDisguise = d;
        const btn = card.querySelector('.setup-btn-primary');
        if (btn) btn.disabled = false;
      });
      grid.appendChild(item);
    });

    const actions = document.createElement('div');
    actions.className = 'setup-actions';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'setup-btn-primary';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = !selectedDisguise;
    nextBtn.addEventListener('click', () => {
      if (selectedDisguise) {
        applyDisguise(selectedDisguise);
        goToStep(1);
      }
    });
    actions.appendChild(nextBtn);

    card.appendChild(header);
    card.appendChild(grid);
    card.appendChild(actions);
    return card;
  }

  /* 
     STEP 1  CLOAKING
      */

  function buildCloakingCard() {
    selectedCloakingOption = selectedCloakingOption || 'enabled';

    const card = document.createElement('div');
    card.className = 'setup-card';
    card.innerHTML = `
      <h2>Hide your screen?</h2>
      <p class="subtitle">Opens Nexora inside a blank tab. History stays clean.</p>
      <div class="setup-option-group">
        <div class="setup-option ${selectedCloakingOption === 'enabled' ? 'selected' : ''}" data-val="enabled">
          <p class="opt-title">Yes, hide it <span class="opt-tag">recommended</span></p>
          <p class="opt-desc">Opens in a hidden blank tab. Your activity stays invisible.</p>
          <div class="opt-radio"></div>
        </div>
        <div class="setup-option ${selectedCloakingOption === 'disabled' ? 'selected' : ''}" data-val="disabled">
          <p class="opt-title">No thanks</p>
          <p class="opt-desc opt-warn">Site stays visible and appears in browser history.</p>
          <div class="opt-radio"></div>
        </div>
      </div>
      <div class="setup-actions">
        <button class="setup-btn-secondary" id="cloak-back">Back</button>
        <button class="setup-btn-primary" id="cloak-next">Next</button>
      </div>
    `;

    setTimeout(() => {
      const opts = card.querySelectorAll('.setup-option');
      opts.forEach(o => o.addEventListener('click', () => {
        opts.forEach(x => x.classList.remove('selected'));
        o.classList.add('selected');
        selectedCloakingOption = o.dataset.val;
      }));
      const back = card.querySelector('#cloak-back');
      const next = card.querySelector('#cloak-next');
      if (back) back.addEventListener('click', () => goToStep(0));
      if (next) next.addEventListener('click', () => {
        applyCloakingSetting(selectedCloakingOption === 'enabled');
        goToStep(2);
      });
    }, 0);

    return card;
  }

  /* 
     STEP 2  PANIC BUTTON
      */

  function buildPanicCard() {
    const card = document.createElement('div');
    card.className = 'setup-card';
    card.innerHTML = `
      <h2>Set a panic key</h2>
      <p class="subtitle">Press a hotkey to instantly switch to a safe page. You can skip this.</p>
      <div class="setup-input-group">
        <div>
          <label>Hotkey  click the box, press any key combo</label>
          <input id="ftm-panic-key" type="text" placeholder="e.g. Ctrl + Q" readonly value="${selectedPanicKey || ''}" />
        </div>
        <div>
          <label>Safe URL  where to redirect</label>
          <input id="ftm-panic-url" type="url" placeholder="https://classroom.google.com" value="${panicUrlValue || ''}" />
        </div>
      </div>
      <div class="setup-actions">
        <button class="setup-btn-secondary" id="panic-back">Back</button>
        <button class="setup-btn-secondary" id="panic-skip">Skip</button>
        <button class="setup-btn-primary" id="panic-next" ${(selectedPanicKey && panicUrlValue) ? '' : 'disabled'}>Next</button>
      </div>
    `;

    setTimeout(() => {
      const keyIn = document.getElementById('ftm-panic-key');
      const urlIn = document.getElementById('ftm-panic-url');
      const nextBtn = card.querySelector('#panic-next');

      function checkReady() {
        if (nextBtn) nextBtn.disabled = !(selectedPanicKey && panicUrlValue);
      }

      if (keyIn) {
        keyIn.addEventListener('click', () => {
          if (window.NexoraPanicButton) window.NexoraPanicButton.setIsSettingKey(true);
          keyIn.value = 'Press a key...';
        });
        keyIn.addEventListener('keydown', e => {
          e.preventDefault();
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
          const parts = [];
          if (e.ctrlKey) parts.push('Ctrl');
          if (e.altKey) parts.push('Alt');
          if (e.shiftKey) parts.push('Shift');
          if (e.metaKey) parts.push('Meta');
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) parts.push(e.key === ' ' ? 'Space' : e.key);
          selectedPanicKey = parts.join(' + ');
          keyIn.value = selectedPanicKey;
          if (window.NexoraPanicButton) window.NexoraPanicButton.setIsSettingKey(false);
          checkReady();
        });
        keyIn.addEventListener('blur', () => {
          if (window.NexoraPanicButton) window.NexoraPanicButton.setIsSettingKey(false);
          if (keyIn.value === 'Press a key...') keyIn.value = selectedPanicKey || '';
        });
      }

      if (urlIn) {
        urlIn.addEventListener('input', () => { panicUrlValue = urlIn.value.trim(); checkReady(); });
      }

      const back = card.querySelector('#panic-back');
      const skip = card.querySelector('#panic-skip');
      if (back) back.addEventListener('click', () => goToStep(1));
      if (skip) skip.addEventListener('click', () => goToStep(3));
      if (nextBtn) nextBtn.addEventListener('click', () => {
        applyPanicSettings(selectedPanicKey, panicUrlValue);
        goToStep(3);
      });
    }, 0);

    return card;
  }

  /* 
     STEP 3  COOKIES
      */

  function buildCookieCard() {
    selectedCookieOption = selectedCookieOption || 'accept';

    const card = document.createElement('div');
    card.className = 'setup-card';
    card.innerHTML = `
      <h2>Save your stuff?</h2>
      <p class="subtitle">We use cookies to remember your settings between visits.</p>
      <div class="setup-option-group">
        <div class="setup-option ${selectedCookieOption === 'accept' ? 'selected' : ''}" data-val="accept">
          <p class="opt-title">Yes, remember me</p>
          <p class="opt-desc">Settings, disguise, and progress stay saved.</p>
          <div class="opt-radio"></div>
        </div>
        <div class="setup-option ${selectedCookieOption === 'decline' ? 'selected' : ''}" data-val="decline">
          <p class="opt-title">No thanks</p>
          <p class="opt-desc opt-warn">Nothing saves. You'll redo settings every visit.</p>
          <div class="opt-radio"></div>
        </div>
      </div>
      <div class="setup-actions">
        <button class="setup-btn-secondary" id="cookie-back">Back</button>
        <button class="setup-btn-primary" id="cookie-next">Next</button>
      </div>
    `;

    setTimeout(() => {
      const opts = card.querySelectorAll('.setup-option');
      opts.forEach(o => o.addEventListener('click', () => {
        opts.forEach(x => x.classList.remove('selected'));
        o.classList.add('selected');
        selectedCookieOption = o.dataset.val;
      }));

      const back = card.querySelector('#cookie-back');
      const next = card.querySelector('#cookie-next');
      if (back) back.addEventListener('click', () => goToStep(2));
      if (next) next.addEventListener('click', () => {
        applyCookieConsent(selectedCookieOption === 'accept');
        markAsVisited();
        updateFill(TOTAL_STEPS); // fill to 100%
        showCompletion();
      });
    }, 0);

    return card;
  }

  /* 
     COMPLETION SCREEN
      */

  function showCompletion() {
    // Hide step dots
    const dotsEl = setupEl.querySelector('.setup-steps');
    if (dotsEl) dotsEl.style.display = 'none';

    transitionCard(() => {
      const card = document.createElement('div');
      card.className = 'setup-card';
      card.innerHTML = `
        <div class="setup-complete">
          <div class="setup-checkmark-circle">
            <svg viewBox="0 0 24 24"><polyline points="6 12 10 16 18 8"/></svg>
          </div>
          <h2>You're all set!</h2>
          <p>Everything is configured. Enjoy Nexora.</p>
          <div class="setup-actions" style="justify-content:center;border:none;padding-top:0;">
            <button class="setup-btn-primary" id="setup-finish">Let's go</button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const fin = card.querySelector('#setup-finish');
        if (fin) fin.addEventListener('click', () => {
          finishSetup();
        });
      }, 0);

      return card;
    });
  }

  /* 
     FINISH  fade out, show loader, then reveal site
      */

  function finishSetup() {
    // Fade out the setup overlay
    setupEl.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    setupEl.style.opacity = '0';

    setTimeout(() => {
      if (setupEl) { setupEl.remove(); setupEl = null; }

      // Show fake loading screen
      showFakeLoader(() => {
        // After loading, show account prompt or handle about:blank
        showAccountPromptOrFinish();
      });
    }, 600);
  }

  function showFakeLoader(callback) {
    const loader = document.createElement('div');
    loader.id = 'nexora-setup-loader';
    loader.innerHTML = `
      <div class="loader-ring"></div>
      <div class="loader-text">Loading<span class="loader-dots"></span></div>
    `;
    document.body.appendChild(loader);

    // Fake load for 1.8 seconds
    setTimeout(() => {
      loader.classList.add('loader-fade-out');
      setTimeout(() => {
        loader.remove();
        if (callback) callback();
      }, 800);
    }, 1800);
  }

  /* 
     ACCOUNT PROMPT (after setup)
      */

  function showAccountPromptOrFinish() {
    markAsVisited();
  }

  function createAccountOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'nexora-setup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;animation:setupFadeIn 0.4s ease forwards;';
    return overlay;
  }

  function showAccountPromptModal(isAfterSetup) {
    const overlay = createAccountOverlay();
    const card = document.createElement('div');
    card.className = 'setup-card';
    card.style.maxWidth = '480px';
    card.style.width = '90%';

    bindMouseTracking(card);

    // Toggle state
    let mode = 'register';

    card.innerHTML = `
      <h2>Save Your Progress</h2>
      <p class="subtitle">${isAfterSetup ? 'Create an account to save your settings across devices.' : 'Create an account to sync settings, favorites, and progress.'}</p>
      <div class="setup-auth-tabs">
        <button class="setup-auth-tab active" data-mode="register">Create Account</button>
        <button class="setup-auth-tab" data-mode="login">Log In</button>
      </div>
      <div class="setup-auth-form">
        <div id="ftm-reg-section">
          <div><label for="ftm-reg-user">Username</label><input id="ftm-reg-user" type="text" placeholder="Min 3 characters" autocomplete="username" /></div>
          <div style="margin-top:12px"><label for="ftm-reg-pass">Password</label><input id="ftm-reg-pass" type="password" placeholder="Min 6 characters" autocomplete="new-password" /></div>
          <div style="margin-top:12px"><label for="ftm-reg-confirm">Confirm Password</label><input id="ftm-reg-confirm" type="password" placeholder="Re-enter password" autocomplete="new-password" /></div>
        </div>
        <div id="ftm-log-section" style="display:none">
          <div><label for="ftm-log-user">Username</label><input id="ftm-log-user" type="text" placeholder="Your username" autocomplete="username" /></div>
          <div style="margin-top:12px"><label for="ftm-log-pass">Password</label><input id="ftm-log-pass" type="password" placeholder="Your password" autocomplete="current-password" /></div>
        </div>
        <div class="setup-auth-error" id="ftm-acct-error"></div>
      </div>
      <div class="setup-actions">
        <button class="setup-btn-secondary" id="ftm-acct-skip">Skip</button>
        <button class="setup-btn-primary" id="ftm-acct-submit">Create Account</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    setTimeout(() => {
      // Tab toggle
      const tabs = card.querySelectorAll('.setup-auth-tab');
      const regSec = card.querySelector('#ftm-reg-section');
      const logSec = card.querySelector('#ftm-log-section');
      const submitBtn = card.querySelector('#ftm-acct-submit');
      const errEl = card.querySelector('#ftm-acct-error');

      tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        mode = tab.dataset.mode;
        regSec.style.display = mode === 'register' ? '' : 'none';
        logSec.style.display = mode === 'login' ? '' : 'none';
        submitBtn.textContent = mode === 'register' ? 'Create Account' : 'Log In';
        errEl.style.display = 'none';
      }));

      // Skip
      card.querySelector('#ftm-acct-skip').addEventListener('click', () => {
        try { localStorage.setItem('nexora.skippedAccountPrompt', Date.now().toString()); } catch(e) {}
        fadeOutOverlay(overlay, () => {
          if (isAfterSetup) handlePostSetupAboutBlank();
        });
      });

      // Submit
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'register' ? 'Creating...' : 'Logging in...';
        try {
          if (!window.NexoraAuth) throw new Error('Auth service not available');
          if (mode === 'register') {
            const user = document.getElementById('ftm-reg-user').value.trim();
            const pass = document.getElementById('ftm-reg-pass').value;
            const conf = document.getElementById('ftm-reg-confirm').value;
            if (!user || user.length < 3) throw new Error('Username must be at least 3 characters');
            if (!pass || pass.length < 6) throw new Error('Password must be at least 6 characters');
            if (pass !== conf) throw new Error('Passwords do not match');
            await window.NexoraAuth.register(user, pass, false);
            fadeOutOverlay(overlay, () => { if (isAfterSetup) handlePostSetupAboutBlank(); });
          } else {
            const user = document.getElementById('ftm-log-user').value.trim();
            const pass = document.getElementById('ftm-log-pass').value;
            if (!user || !pass) throw new Error('Please enter username and password');
            await window.NexoraAuth.login(user, pass, true);
          }
        } catch (e) {
          errEl.textContent = e.message || 'An error occurred';
          errEl.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'register' ? 'Create Account' : 'Log In';
        }
      });
    }, 0);
  }

  function fadeOutOverlay(overlay, cb) {
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); if (cb) cb(); }, 400);
  }

  /*  Post-setup about:blank redirect  */

  function handlePostSetupAboutBlank() {
    try {
      const aboutBlankEnabled = localStorage.getItem(ABOUT_KEY);
      if (aboutBlankEnabled === 'true' && selectedDisguise) {
        setTimeout(() => {
          const win = window.open('about:blank', '_blank');
          if (win) {
            try {
              const doc = win.document;
              const dData = DISGUISE_OPTIONS.find(d => d.name === selectedDisguise.name);
              const dTitle = dData ? dData.title : 'Loading...';
              const dIcon = dData ? dData.icon : '';
              doc.open();
              let html = '<!DOCTYPE html><html><head><title>' + dTitle + '</title>';
              if (dIcon) html += '<link rel="icon" href="' + dIcon + '">';
              html += '</head><body style="margin:0;padding:0;overflow:hidden;"></body></html>';
              doc.write(html);
              doc.close();
              const iframe = doc.createElement('iframe');
              iframe.style.cssText = 'width:100%;height:100%;border:none;margin:0;padding:0;position:absolute;top:0;left:0;';
              iframe.src = window.location.origin;
              iframe.name = 'nexora-cloaked';
              iframe.setAttribute('loading', 'eager');
              iframe.setAttribute('referrerpolicy', 'no-referrer');
              doc.body.appendChild(iframe);
              window._aboutWin = win;
              setTimeout(() => redirectToDisguiseSite(), 500);
            } catch (err) {}
          }
        }, 400);
      }
    } catch (e) {}
  }

  function redirectToDisguiseSite() {
    if (!selectedDisguise) return;
    const url = DISGUISE_URLS[selectedDisguise.name];
    if (url) {
      try { window.location.href = url; } catch (e) {}
    }
  }

  /* 
     INIT
      */

  function init() {
    if (window.self !== window.top) return;

    if (hasAccount()) {
      markAsVisited();
      return;
    }

    if (isFirstVisit()) {
      showWelcomeChoice();
    } else if (!hasAccount()) {
      showAccountPromptModal(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NexoraFirstTime = {
    showModal: function () { showWelcomeChoice(); },
    showWelcomeChoiceModal: showWelcomeChoice,
    showAccountPromptModal: showAccountPromptModal,
    isFirstVisit: isFirstVisit,
    hasAccount: hasAccount
  };
})();
