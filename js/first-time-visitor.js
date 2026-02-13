(function () {
  'use strict';

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
    { 
      name: "Clever", 
      title: "Clever | Portal",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/clever.ico"
    },
    { 
      name: "Google Classroom", 
      title: "Home",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/classroom.ico"
    },
    { 
      name: "Canvas", 
      title: "Dashboard",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/canvas.png"
    },
    { 
      name: "Google Drive", 
      title: "Home - Google Drive",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/drive.png"
    },
    { 
      name: "Seesaw", 
      title: "Seesaw",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/seesaw.jpg"
    },
    { 
      name: "Edpuzzle", 
      title: "Edpuzzle",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/edpuzzle.png"
    },
    { 
      name: "Kahoot!", 
      title: "Enter Game PIN - Kahoot!",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/kahoot.ico"
    },
    { 
      name: "Quizlet", 
      title: "Your Sets | Quizlet",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/quizlet.png"
    },
    { 
      name: "Khan Academy", 
      title: "Dashboard | Khan Academy",
      icon: "https://cdn.jsdelivr.net/gh/nexora240-lgtm/Nexora-Assets/favicon/khanacademy.ico"
    }
  ];

  let selectedDisguise = null;

  function getCookie(name) {
    try {
      const match = document.cookie.match('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)');
      return match ? decodeURIComponent(match[1]) : '';
    } catch (e) {
      return '';
    }
  }

  function setCookie(name, value, days = COOKIE_MAX_DAYS) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + 
                   '; expires=' + expires + '; path=/; SameSite=Lax';
      if (location.protocol === 'https:') cookie += '; Secure';
      document.cookie = cookie;
    } catch (e) {
      
    }
  }

  function isFirstVisit() {
    try {

      const hasVisitedFlag = localStorage.getItem(FIRST_VISIT_KEY);
      if (hasVisitedFlag) {
        return false; // User completed the first-time modal
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  function markAsVisited() {
    try {
      localStorage.setItem(FIRST_VISIT_KEY, 'true');
    } catch (e) {
      
    }
  }

  function createModal() {

    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'first-time-modal';

    modal.addEventListener('mousemove', (e) => {
      const rect = modal.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      modal.style.setProperty('--x', x + '%');
      modal.style.setProperty('--y', y + '%');
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Welcome to Nexora!</h2>
      <p class="subtitle">
        For your privacy, choose a disguise to make this site look like an educational platform. 
        You can change this anytime in Settings.
      </p>
    `;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'disguise-options';

    DISGUISE_OPTIONS.forEach((disguise) => {
      const option = document.createElement('div');
      option.className = 'disguise-option';
      option.dataset.disguise = disguise.name;
      
      option.innerHTML = `
        <div class="icon">
          <img src="${disguise.icon}" alt="${disguise.name}" onerror="this.style.display='none'">
        </div>
        <p class="name">${disguise.name}</p>
        <div class="checkmark">✓</div>
      `;

      option.addEventListener('click', () => {

        optionsContainer.querySelectorAll('.disguise-option').forEach(opt => {
          opt.classList.remove('selected');
        });

        option.classList.add('selected');
        selectedDisguise = disguise;

        continueBtn.disabled = false;
      });

      optionsContainer.appendChild(option);
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    continueBtn.addEventListener('click', handleContinue);

    actions.appendChild(continueBtn);

    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyDisguise(disguise) {
    try {

      localStorage.setItem(DISGUISE_KEY, disguise.name);
      localStorage.setItem(FAVICON_KEY, disguise.icon);

      setCookie(COOKIE_NAME, disguise.name);
      setCookie(COOKIE_FAV, disguise.icon);

      document.title = disguise.title;

      const existingFavicons = document.querySelectorAll('link[rel~="icon"]');
      existingFavicons.forEach(link => link.remove());

      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = disguise.icon;

      if (disguise.icon.includes('.ico')) {
        link.type = 'image/x-icon';
      } else if (disguise.icon.includes('.png')) {
        link.type = 'image/png';
      } else if (disguise.icon.includes('.svg')) {
        link.type = 'image/svg+xml';
      }
      
      document.head.appendChild(link);
    } catch (e) {
      
    }
  }

  function handleSkip() {
    markAsVisited();
    closeModal();
  }

  function handleContinue() {
    if (selectedDisguise) {
      applyDisguise(selectedDisguise);
      closeModal();

      setTimeout(() => showCloakingModal(), 300);
    }
  }

  function closeModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  
  let selectedCloakingOption = null;

  function createCloakingModal() {

    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'cloaking-modal';

    let rafId = null;
    modal.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = modal.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        modal.style.setProperty('--x', x + '%');
        modal.style.setProperty('--y', y + '%');
        rafId = null;
      });
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>About:Blank 🔒</h2>
      <p class="subtitle">
        Prevents others from seeing your screen and hides this site from browser history.
      </p>
    `;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'cloaking-options';

    const enableOption = document.createElement('div');
    enableOption.className = 'cloaking-option';
    enableOption.dataset.value = 'enabled';
    enableOption.innerHTML = `
      <div class="option-header">
        <div class="icon-wrapper">🛡️</div>
        <h3 class="option-title">Enable Cloaking</h3>
      </div>
      <p class="option-description">
        Opens in about:blank window. People won't see your screen and it hides from search history.
      </p>
      <div class="checkmark-radio"></div>
    `;

    const disableOption = document.createElement('div');
    disableOption.className = 'cloaking-option';
    disableOption.dataset.value = 'disabled';
    disableOption.innerHTML = `
      <div class="option-header">
        <div class="icon-wrapper">🌐</div>
        <h3 class="option-title">No Cloaking</h3>
      </div>
      <p class="option-description">
        Use the site normally without about:blank cloaking. You can always enable this later in Settings.
      </p>
      <div class="checkmark-radio"></div>
    `;

    [enableOption, disableOption].forEach(option => {
      option.addEventListener('click', () => {
        optionsContainer.querySelectorAll('.cloaking-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        option.classList.add('selected');
        selectedCloakingOption = option.dataset.value;
        continueBtn.disabled = false;
      });
    });

    optionsContainer.appendChild(enableOption);
    optionsContainer.appendChild(disableOption);

    // Set "Enable Cloaking" as selected by default
    enableOption.classList.add('selected');
    selectedCloakingOption = 'enabled';

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = false;
    continueBtn.addEventListener('click', handleCloakingContinue);

    actions.appendChild(continueBtn);

    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyCloakingSetting(enabled) {
    try {


      localStorage.setItem(ABOUT_KEY, JSON.stringify(!!enabled));
    } catch (e) {
      
    }
  }

  function redirectToDisguiseSite() {
    if (!selectedDisguise) return;

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

    const url = DISGUISE_URLS[selectedDisguise.name];
    if (url) {
      try {
        window.location.href = url;
      } catch (e) {
        
      }
    }
  }

  function handleCloakingSkip() {
    closeCloakingModal();

    setTimeout(() => showPanicButtonModal(), 300);
  }

  function handleCloakingContinue() {
    if (selectedCloakingOption) {
      const enabled = selectedCloakingOption === 'enabled';
      applyCloakingSetting(enabled);
      closeCloakingModal();

      setTimeout(() => showPanicButtonModal(), 300);
    }
  }

  function closeCloakingModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  function showCloakingModal() {
    const modal = createCloakingModal();
    document.body.appendChild(modal);
  }


  
  let selectedPanicKey = null;
  let panicUrlValue = '';

  function createPanicButtonModal() {

    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'panic-button-modal';

    let rafId = null;
    modal.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = modal.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        modal.style.setProperty('--x', x + '%');
        modal.style.setProperty('--y', y + '%');
        rafId = null;
      });
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Panic Button ⚡</h2>
      <p class="subtitle">
        Set a keybind to instantly redirect to a safe URL when someone approaches. Optional but recommended.
      </p>
    `;

    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'panic-inputs';
    inputsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 16px; margin: 20px 0;';

    const keyInputWrapper = document.createElement('div');
    keyInputWrapper.innerHTML = `
      <label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--muted, #9e8c80); font-weight: 500;">
        Keybind
      </label>
      <input 
        id="panic-key-input-modal" 
        type="text" 
        placeholder="Click and press a key combination" 
        readonly
        style="width: 100%; padding: 12px 16px; border-radius: 10px; background: var(--surface-2, #261813); border: 1px solid rgba(255,255,255,0.08); color: var(--text, #f5f0ed); font-size: 15px; cursor: pointer; transition: border-color 0.2s ease;"
      />
    `;

    const urlInputWrapper = document.createElement('div');
    urlInputWrapper.innerHTML = `
      <label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--muted, #9e8c80); font-weight: 500;">
        Redirect URL
      </label>
      <input 
        id="panic-url-input-modal" 
        type="url" 
        placeholder="https://classroom.google.com" 
        style="width: 100%; padding: 12px 16px; border-radius: 10px; background: var(--surface-2, #261813); border: 1px solid rgba(255,255,255,0.08); color: var(--text, #f5f0ed); font-size: 15px; transition: border-color 0.2s ease;"
      />
    `;

    inputsContainer.appendChild(keyInputWrapper);
    inputsContainer.appendChild(urlInputWrapper);

    setTimeout(() => {
      const keyInput = document.getElementById('panic-key-input-modal');
      const urlInput = document.getElementById('panic-url-input-modal');
      
      if (keyInput) {
        keyInput.addEventListener('keydown', (event) => {
          event.preventDefault();

          if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
            return;
          }
          
          const parts = [];
          if (event.ctrlKey) parts.push('Ctrl');
          if (event.altKey) parts.push('Alt');
          if (event.shiftKey) parts.push('Shift');
          if (event.metaKey) parts.push('Meta');
          
          const mainKey = event.key;
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) {
            parts.push(mainKey === ' ' ? 'Space' : mainKey);
          }
          
          const keyCombo = parts.join(' + ');
          selectedPanicKey = keyCombo;
          keyInput.value = keyCombo;

          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(false);
          }

          if (panicUrlValue || urlInput.value.trim()) {
            continueBtn.disabled = false;
          }
        });

        keyInput.addEventListener('click', () => {

          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(true);
          }
          keyInput.value = 'Press a key...';
        });

        keyInput.addEventListener('blur', () => {

          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(false);
          }
          if (keyInput.value === 'Press a key...') {
            keyInput.value = selectedPanicKey || '';
          }
        });
      }
      
      if (urlInput) {
        urlInput.addEventListener('input', () => {
          panicUrlValue = urlInput.value.trim();

          if (selectedPanicKey && panicUrlValue) {
            continueBtn.disabled = false;
          }
        });
      }
    }, 0);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-skip';
    skipBtn.textContent = 'Skip for Now';
    skipBtn.addEventListener('click', handlePanicSkip);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    continueBtn.addEventListener('click', handlePanicContinue);

    actions.appendChild(skipBtn);
    actions.appendChild(continueBtn);

    modal.appendChild(header);
    modal.appendChild(inputsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyPanicSettings(keyCombo, url) {
    try {
      if (keyCombo && url) {
        localStorage.setItem(PANIC_KEY_KEY, keyCombo);
        localStorage.setItem(PANIC_URL_KEY, url);
      }
    } catch (e) {
      
    }
  }

  function handlePanicSkip() {
    closePanicModal();

    setTimeout(() => showCookieConsentModal(), 300);
  }

  function handlePanicContinue() {
    if (selectedPanicKey && panicUrlValue) {
      applyPanicSettings(selectedPanicKey, panicUrlValue);
    }
    closePanicModal();

    setTimeout(() => showCookieConsentModal(), 300);
  }

  function closePanicModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  function showPanicButtonModal() {
    const modal = createPanicButtonModal();
    document.body.appendChild(modal);
  }


  
  let selectedCookieOption = null;

  function createCookieConsentModal() {

    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'cookie-consent-modal';

    let rafId = null;
    modal.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = modal.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        modal.style.setProperty('--x', x + '%');
        modal.style.setProperty('--y', y + '%');
        rafId = null;
      });
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Cookie & Storage Preferences 🍪</h2>
      <p class="subtitle">
        Choose how you want to use this site. Cookies and localStorage help us save your preferences and progress.
      </p>
    `;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'cookie-options';

    const acceptOption = document.createElement('div');
    acceptOption.className = 'cookie-option';
    acceptOption.dataset.value = 'accept';
    acceptOption.innerHTML = `
      <div class="option-header">
        <div class="icon-wrapper">✓</div>
        <h3 class="option-title">Accept Cookies</h3>
      </div>
      <p class="option-description">
        Enable full functionality with saved preferences, game progress, and settings.
      </p>
      <ul class="consequences-list">
        <li>✓ Save your game progress and favorites</li>
        <li>✓ Remember your theme and settings</li>
        <li>✓ Keep your disguise preferences</li>
        <li>✓ Full site functionality</li>
      </ul>
      <div class="checkmark-radio"></div>
    `;

    const declineOption = document.createElement('div');
    declineOption.className = 'cookie-option';
    declineOption.dataset.value = 'decline';
    declineOption.innerHTML = `
      <div class="option-header">
        <div class="icon-wrapper">⚠️</div>
        <h3 class="option-title">Decline Cookies</h3>
      </div>
      <p class="option-description">
        Use the site with limited functionality. Some features will not work properly.
      </p>
      <ul class="consequences-list">
        <li>✗ Game progress will NOT be saved</li>
        <li>✗ Settings reset every visit</li>
        <li>✗ Disguise preferences not saved</li>
        <li>✗ Limited functionality</li>
      </ul>
      <span class="warning-badge">⚠ Limited Experience</span>
      <div class="checkmark-radio"></div>
    `;

    [acceptOption, declineOption].forEach(option => {
      option.addEventListener('click', () => {
        optionsContainer.querySelectorAll('.cookie-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        option.classList.add('selected');
        selectedCookieOption = option.dataset.value;
        continueBtn.disabled = false;
      });
    });

    optionsContainer.appendChild(acceptOption);
    optionsContainer.appendChild(declineOption);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Finish Setup';
    continueBtn.disabled = true;
    continueBtn.addEventListener('click', handleCookieConsentContinue);

    acceptOption.classList.add('selected');
    selectedCookieOption = 'accept';
    continueBtn.disabled = false;

    actions.appendChild(continueBtn);

    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyCookieConsent(accepted) {
    try {
      if (accepted) {

        localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');

      } else {

        localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');

        try {

          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
          });

          const itemsToKeep = [COOKIE_CONSENT_KEY, FIRST_VISIT_KEY];
          Object.keys(localStorage).forEach(key => {
            if (!itemsToKeep.includes(key)) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {
          
        }
      }
    } catch (e) {
      
    }
  }

  function handleCookieConsentContinue() {
    if (!selectedCookieOption) return;
    
    const accepted = selectedCookieOption === 'accept';
    applyCookieConsent(accepted);

    markAsVisited();

    closeCookieConsentModal();

    // Show account creation prompt after setup
    setTimeout(() => showAccountPromptModal(true), 300);
  }

  function closeCookieConsentModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  function showCookieConsentModal() {
    const modal = createCookieConsentModal();
    document.body.appendChild(modal);
  }


  function showFirstTimeModal() {

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const modal = createModal();
        document.body.appendChild(modal);
      });
    } else {
      const modal = createModal();
      document.body.appendChild(modal);
    }
  }

  // =============================================
  // WELCOME CHOICE MODAL (Login vs New Setup)
  // =============================================

  function createWelcomeChoiceModal() {
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'welcome-choice-modal';
    modal.className = 'ftm-modal';

    modal.addEventListener('mousemove', (e) => {
      const rect = modal.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      modal.style.setProperty('--x', x + '%');
      modal.style.setProperty('--y', y + '%');
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Welcome to Nexora!</h2>
      <p class="subtitle">
        Already have an account? Log in to sync your settings. New here? Start fresh with a quick setup.
      </p>
    `;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'welcome-options';

    const loginOption = document.createElement('div');
    loginOption.className = 'welcome-option';
    loginOption.innerHTML = `
      <div class="option-header">
        <div class="icon-wrapper">👤</div>
        <h3 class="option-title">Log In</h3>
      </div>
      <p class="option-description">
        Sign in to your existing account to sync your settings, favorites, and progress across all devices.
      </p>
    `;

    const newSetupOption = document.createElement('div');
    newSetupOption.className = 'welcome-option';
    newSetupOption.innerHTML = `
      <div class="option-header">
        <div class="icon-wrapper">✨</div>
        <h3 class="option-title">New Setup</h3>
      </div>
      <p class="option-description">
        First time here? Let's set up your disguise, privacy settings, and preferences.
      </p>
    `;

    loginOption.addEventListener('click', () => {
      closeWelcomeChoiceModal();
      setTimeout(() => showLoginFormModal(), 300);
    });

    newSetupOption.addEventListener('click', () => {
      closeWelcomeChoiceModal();
      setTimeout(() => showFirstTimeModal(), 300);
    });

    optionsContainer.appendChild(loginOption);
    optionsContainer.appendChild(newSetupOption);

    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    overlay.appendChild(modal);

    return overlay;
  }

  function closeWelcomeChoiceModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  function showWelcomeChoiceModal() {
    const modal = createWelcomeChoiceModal();
    document.body.appendChild(modal);
  }

  // =============================================
  // LOGIN FORM MODAL
  // =============================================

  function createLoginFormModal() {
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'login-form-modal';
    modal.className = 'ftm-modal';

    modal.addEventListener('mousemove', (e) => {
      const rect = modal.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      modal.style.setProperty('--x', x + '%');
      modal.style.setProperty('--y', y + '%');
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Log In 👤</h2>
      <p class="subtitle">
        Sign in to sync your settings, favorites, and progress across all devices.
      </p>
    `;

    const formContainer = document.createElement('div');
    formContainer.className = 'auth-form-container';
    formContainer.innerHTML = `
      <div class="auth-input-group">
        <label for="login-username-input">Username</label>
        <input 
          id="login-username-input" 
          type="text" 
          placeholder="Enter your username"
          autocomplete="username"
        />
      </div>
      <div class="auth-input-group">
        <label for="login-password-input">Password</label>
        <input 
          id="login-password-input" 
          type="password" 
          placeholder="Enter your password"
          autocomplete="current-password"
        />
      </div>
      <div id="login-error-message" class="auth-error-message" style="display: none;"></div>
    `;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn-skip';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => {
      closeLoginFormModal();
      setTimeout(() => showWelcomeChoiceModal(), 300);
    });

    const loginBtn = document.createElement('button');
    loginBtn.className = 'btn-continue';
    loginBtn.textContent = 'Log In';
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('login-username-input').value.trim();
      const password = document.getElementById('login-password-input').value;
      const errorEl = document.getElementById('login-error-message');
      
      if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        errorEl.style.display = 'block';
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';

      try {
        if (window.NexoraAuth) {
          await window.NexoraAuth.login(username, password, true);
          // If we get here, login succeeded - page will reload
        } else {
          throw new Error('Auth service not available');
        }
      } catch (e) {
        errorEl.textContent = e.message || 'Login failed';
        errorEl.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
      }
    });

    actions.appendChild(backBtn);
    actions.appendChild(loginBtn);

    modal.appendChild(header);
    modal.appendChild(formContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function closeLoginFormModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  function showLoginFormModal() {
    const modal = createLoginFormModal();
    document.body.appendChild(modal);
  }

  // =============================================
  // ACCOUNT CREATION MODAL (shown after setup)
  // =============================================

  function createAccountPromptModal(isAfterSetup = false) {
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    const modal = document.createElement('div');
    modal.id = 'account-prompt-modal';
    modal.className = 'ftm-modal';

    modal.addEventListener('mousemove', (e) => {
      const rect = modal.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      modal.style.setProperty('--x', x + '%');
      modal.style.setProperty('--y', y + '%');
    });

    modal.addEventListener('mouseleave', () => {
      modal.style.setProperty('--x', '50%');
      modal.style.setProperty('--y', '50%');
    });

    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Save Your Progress 🔐</h2>
      <p class="subtitle">
        ${isAfterSetup 
          ? 'Create an account to save your settings and sync them across all your devices.' 
          : 'Create an account to save your settings, favorites, and game progress across all devices.'}
      </p>
    `;

    const formContainer = document.createElement('div');
    formContainer.className = 'auth-form-container';

    // Toggle between Create and Login
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'auth-toggle-container';
    toggleContainer.innerHTML = `
      <button class="auth-toggle-btn active" data-mode="register">Create Account</button>
      <button class="auth-toggle-btn" data-mode="login">Log In</button>
    `;

    const registerForm = document.createElement('div');
    registerForm.id = 'register-form-section';
    registerForm.innerHTML = `
      <div class="auth-input-group">
        <label for="register-username-input">Username</label>
        <input 
          id="register-username-input" 
          type="text" 
          placeholder="Choose a username (min 3 characters)"
          autocomplete="username"
        />
      </div>
      <div class="auth-input-group">
        <label for="register-password-input">Password</label>
        <input 
          id="register-password-input" 
          type="password" 
          placeholder="Choose a password (min 6 characters)"
          autocomplete="new-password"
        />
      </div>
      <div class="auth-input-group">
        <label for="register-confirm-input">Confirm Password</label>
        <input 
          id="register-confirm-input" 
          type="password" 
          placeholder="Confirm your password"
          autocomplete="new-password"
        />
      </div>
    `;

    const loginForm = document.createElement('div');
    loginForm.id = 'login-form-section';
    loginForm.style.display = 'none';
    loginForm.innerHTML = `
      <div class="auth-input-group">
        <label for="prompt-login-username">Username</label>
        <input 
          id="prompt-login-username" 
          type="text" 
          placeholder="Enter your username"
          autocomplete="username"
        />
      </div>
      <div class="auth-input-group">
        <label for="prompt-login-password">Password</label>
        <input 
          id="prompt-login-password" 
          type="password" 
          placeholder="Enter your password"
          autocomplete="current-password"
        />
      </div>
    `;

    const errorMessage = document.createElement('div');
    errorMessage.id = 'account-prompt-error';
    errorMessage.className = 'auth-error-message';
    errorMessage.style.display = 'none';

    formContainer.appendChild(toggleContainer);
    formContainer.appendChild(registerForm);
    formContainer.appendChild(loginForm);
    formContainer.appendChild(errorMessage);

    // Toggle functionality
    setTimeout(() => {
      const toggleBtns = toggleContainer.querySelectorAll('.auth-toggle-btn');
      toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          toggleBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const mode = btn.dataset.mode;
          registerForm.style.display = mode === 'register' ? 'block' : 'none';
          loginForm.style.display = mode === 'login' ? 'block' : 'none';
          submitBtn.textContent = mode === 'register' ? 'Create Account' : 'Log In';
          errorMessage.style.display = 'none';
        });
      });
    }, 0);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-skip';
    skipBtn.textContent = 'Skip for Now';
    skipBtn.addEventListener('click', () => {
      // Mark that user skipped account creation
      try { localStorage.setItem('nexora.skippedAccountPrompt', Date.now().toString()); } catch(e) {}
      closeAccountPromptModal();
      
      // If this is after setup, trigger the about:blank flow if needed
      if (isAfterSetup) {
        handlePostSetupAboutBlank();
      }
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-continue';
    submitBtn.textContent = 'Create Account';
    submitBtn.addEventListener('click', async () => {
      const isRegister = registerForm.style.display !== 'none';
      const errorEl = document.getElementById('account-prompt-error');
      
      submitBtn.disabled = true;
      submitBtn.textContent = isRegister ? 'Creating...' : 'Logging in...';
      
      try {
        if (!window.NexoraAuth) {
          throw new Error('Auth service not available');
        }

        if (isRegister) {
          const username = document.getElementById('register-username-input').value.trim();
          const password = document.getElementById('register-password-input').value;
          const confirm = document.getElementById('register-confirm-input').value;

          if (!username || username.length < 3) {
            throw new Error('Username must be at least 3 characters');
          }
          if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters');
          }
          if (password !== confirm) {
            throw new Error('Passwords do not match');
          }

          await window.NexoraAuth.register(username, password, false);
          closeAccountPromptModal();
          
          // If after setup, handle the about:blank flow
          if (isAfterSetup) {
            handlePostSetupAboutBlank();
          }
        } else {
          const username = document.getElementById('prompt-login-username').value.trim();
          const password = document.getElementById('prompt-login-password').value;

          if (!username || !password) {
            throw new Error('Please enter username and password');
          }

          await window.NexoraAuth.login(username, password, true);
          // Page will reload
        }
      } catch (e) {
        errorEl.textContent = e.message || 'An error occurred';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = isRegister ? 'Create Account' : 'Log In';
      }
    });

    actions.appendChild(skipBtn);
    actions.appendChild(submitBtn);

    modal.appendChild(header);
    modal.appendChild(formContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function closeAccountPromptModal() {
    const overlay = document.getElementById('first-time-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  function showAccountPromptModal(isAfterSetup = false) {
    const modal = createAccountPromptModal(isAfterSetup);
    document.body.appendChild(modal);
  }

  function handlePostSetupAboutBlank() {
    try {
      const aboutBlankEnabled = localStorage.getItem(ABOUT_KEY);
      if (aboutBlankEnabled === 'true' && selectedDisguise) {
        setTimeout(() => {
          const win = window.open('about:blank', '_blank');
          if (win) {
            try {
              const doc = win.document;
              doc.open();
              doc.write('<!DOCTYPE html><html><head><title>Loading...</title></head><body style="margin:0;padding:0;overflow:hidden;"></body></html>');
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
              iframe.src = window.location.origin;
              iframe.setAttribute('loading', 'eager');
              iframe.setAttribute('referrerpolicy', 'no-referrer');
              doc.body.style.margin = '0';
              doc.body.style.padding = '0';
              doc.body.style.overflow = 'hidden';
              doc.body.appendChild(iframe);

              window._aboutWin = win;

              setTimeout(() => {
                redirectToDisguiseSite();
              }, 500);
            } catch (err) {}
          }
        }, 400);
      }
    } catch (e) {}
  }

  // =============================================
  // CHECK IF USER HAS ACCOUNT
  // =============================================

  function hasAccount() {
    try {
      const credentials = localStorage.getItem('nexora.auth.credentials');
      return credentials !== null;
    } catch (e) {
      return false;
    }
  }

  function hasSkippedRecently() {
    try {
      const skippedTime = localStorage.getItem('nexora.skippedAccountPrompt');
      if (!skippedTime) return false;
      
      // Check if skipped within the last 24 hours
      const hoursSinceSkip = (Date.now() - parseInt(skippedTime)) / (1000 * 60 * 60);
      return hoursSinceSkip < 24;
    } catch (e) {
      return false;
    }
  }

  function init() {

    if (window.self !== window.top) {
      return;
    }
    
    // If user has an account (logged in), they don't need the first-time flow
    if (hasAccount()) {
      // Mark as visited so they don't see the flow again if they log out
      markAsVisited();
      return;
    }
    
    if (isFirstVisit()) {
      // First time visitor - show welcome choice (Login vs New Setup)
      showWelcomeChoiceModal();
    } else if (!hasAccount()) {
      // Not first visit, but no account - always prompt to create account
      showAccountPromptModal(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NexoraFirstTime = {
    showModal: showFirstTimeModal,
    showWelcomeChoiceModal: showWelcomeChoiceModal,
    showAccountPromptModal: showAccountPromptModal,
    isFirstVisit: isFirstVisit,
    hasAccount: hasAccount
  };
})();
