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

  // Disguise options with their details
  const DISGUISE_OPTIONS = [
    { 
      name: "Clever", 
      title: "Clever | Portal",
      icon: "/assets/favicon/clever.ico"
    },
    { 
      name: "Google Classroom", 
      title: "Home",
      icon: "/assets/favicon/classroom.ico"
    },
    { 
      name: "Canvas", 
      title: "Dashboard",
      icon: "/assets/favicon/canvas.png"
    },
    { 
      name: "Google Drive", 
      title: "Home - Google Drive",
      icon: "/assets/favicon/drive.png"
    },
    { 
      name: "Seesaw", 
      title: "Seesaw",
      icon: "/assets/favicon/seesaw.jpg"
    },
    { 
      name: "Edpuzzle", 
      title: "Edpuzzle",
      icon: "/assets/favicon/edpuzzle.png"
    },
    { 
      name: "Kahoot!", 
      title: "Enter Game PIN - Kahoot!",
      icon: "/assets/favicon/kahoot.ico"
    },
    { 
      name: "Quizlet", 
      title: "Your Sets | Quizlet",
      icon: "/assets/favicon/quizlet.png"
    },
    { 
      name: "Khan Academy", 
      title: "Dashboard | Khan Academy",
      icon: "/assets/favicon/khanacademy.ico"
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
      console.error('Failed to set cookie:', e);
    }
  }

  function isFirstVisit() {
    try {
      // Check if user has completed first-time modal
      const hasVisitedFlag = localStorage.getItem(FIRST_VISIT_KEY);
      if (hasVisitedFlag) {
        return false; // User completed the first-time modal
      }

      // Show modal for all users (including existing ones) since this is a new feature
      return true;
    } catch (e) {
      return false;
    }
  }

  function markAsVisited() {
    try {
      localStorage.setItem(FIRST_VISIT_KEY, 'true');
    } catch (e) {
      console.error('Failed to mark as visited:', e);
    }
  }

  function createModal() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'first-time-modal';

    // Add mouse tracking for glow effect
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

    // Modal header
    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Welcome to Nexora!</h2>
      <p class="subtitle">
        For your privacy, choose a disguise to make this site look like an educational platform. 
        You can change this anytime in Settings.
      </p>
    `;

    // Create disguise options grid
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
        // Remove selection from all options
        optionsContainer.querySelectorAll('.disguise-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        // Select this option
        option.classList.add('selected');
        selectedDisguise = disguise;
        
        // Enable continue button
        continueBtn.disabled = false;
      });

      optionsContainer.appendChild(option);
    });

    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-skip';
    skipBtn.textContent = 'Skip for Now';
    skipBtn.addEventListener('click', handleSkip);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    continueBtn.addEventListener('click', handleContinue);

    actions.appendChild(skipBtn);
    actions.appendChild(continueBtn);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyDisguise(disguise) {
    try {
      // Save to localStorage
      localStorage.setItem(DISGUISE_KEY, disguise.name);
      localStorage.setItem(FAVICON_KEY, disguise.icon);
      
      // Save to cookies
      setCookie(COOKIE_NAME, disguise.name);
      setCookie(COOKIE_FAV, disguise.icon);

      // Apply title
      document.title = disguise.title;

      // Apply favicon
      const existingFavicons = document.querySelectorAll('link[rel~="icon"]');
      existingFavicons.forEach(link => link.remove());

      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = disguise.icon;
      
      // Set appropriate type based on file extension
      if (disguise.icon.includes('.ico')) {
        link.type = 'image/x-icon';
      } else if (disguise.icon.includes('.png')) {
        link.type = 'image/png';
      } else if (disguise.icon.includes('.svg')) {
        link.type = 'image/svg+xml';
      }
      
      document.head.appendChild(link);
    } catch (e) {
      console.error('Failed to apply disguise:', e);
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
      // Show cloaking modal after disguise selection
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

  // === About:blank Cloaking Modal ===
  
  let selectedCloakingOption = null;

  function createCloakingModal() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'cloaking-modal';

    // Add mouse tracking for glow effect
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

    // Modal header
    const header = document.createElement('div');
    header.innerHTML = `
      <h2>About:Blank 🔒</h2>
      <p class="subtitle">
        Prevents others from seeing your screen and hides this site from browser history.
      </p>
    `;

    // Create cloaking options
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

    // Add click handlers
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

    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', handleCloakingSkip);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    continueBtn.addEventListener('click', handleCloakingContinue);

    actions.appendChild(skipBtn);
    actions.appendChild(continueBtn);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyCloakingSetting(enabled) {
    try {
      // Only save the setting to localStorage
      // Do NOT trigger about:blank here - that happens in handleCookieConsentContinue
      localStorage.setItem(ABOUT_KEY, JSON.stringify(!!enabled));
    } catch (e) {
      console.error('Failed to apply cloaking setting:', e);
    }
  }

  function redirectToDisguiseSite() {
    if (!selectedDisguise) return;
    
    // Map of disguises to their actual URLs
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
        console.error('Failed to redirect:', e);
      }
    }
  }

  function handleCloakingSkip() {
    closeCloakingModal();
    // Show panic button modal after skipping cloaking
    setTimeout(() => showPanicButtonModal(), 300);
  }

  function handleCloakingContinue() {
    if (selectedCloakingOption) {
      const enabled = selectedCloakingOption === 'enabled';
      applyCloakingSetting(enabled);
      closeCloakingModal();
      // Show panic button modal after cloaking selection
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

  // === End Cloaking Modal ===

  // === Panic Button Modal ===
  
  let selectedPanicKey = null;
  let panicUrlValue = '';

  function createPanicButtonModal() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'panic-button-modal';

    // Add mouse tracking for glow effect
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

    // Modal header
    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Panic Button ⚡</h2>
      <p class="subtitle">
        Set a keybind to instantly redirect to a safe URL when someone approaches. Optional but recommended.
      </p>
    `;

    // Create input container
    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'panic-inputs';
    inputsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 16px; margin: 20px 0;';

    // Keybind input
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

    // URL input
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

    // Get input elements
    setTimeout(() => {
      const keyInput = document.getElementById('panic-key-input-modal');
      const urlInput = document.getElementById('panic-url-input-modal');
      
      if (keyInput) {
        keyInput.addEventListener('keydown', (event) => {
          event.preventDefault();
          
          // Ignore modifier-only keys
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
          
          // Re-enable panic button after setting key
          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(false);
          }
          
          // Enable continue button if URL is also set
          if (panicUrlValue || urlInput.value.trim()) {
            continueBtn.disabled = false;
          }
        });

        keyInput.addEventListener('click', () => {
          // Disable panic button while setting key
          if (window.NexoraPanicButton) {
            window.NexoraPanicButton.setIsSettingKey(true);
          }
          keyInput.value = 'Press a key...';
        });

        keyInput.addEventListener('blur', () => {
          // Re-enable panic button when input loses focus
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
          // Enable continue button if both are set
          if (selectedPanicKey && panicUrlValue) {
            continueBtn.disabled = false;
          }
        });
      }
    }, 0);

    // Create action buttons
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

    // Assemble modal
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
      console.error('Failed to apply panic settings:', e);
    }
  }

  function handlePanicSkip() {
    closePanicModal();
    // Show cookie consent modal after skipping panic button
    setTimeout(() => showCookieConsentModal(), 300);
  }

  function handlePanicContinue() {
    if (selectedPanicKey && panicUrlValue) {
      applyPanicSettings(selectedPanicKey, panicUrlValue);
    }
    closePanicModal();
    // Show cookie consent modal after panic button setup
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

  // === End Panic Button Modal ===

  // === Cookie Consent Modal ===
  
  let selectedCookieOption = null;

  function createCookieConsentModal() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'first-time-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'cookie-consent-modal';

    // Add mouse tracking for glow effect
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

    // Modal header
    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Cookie & Storage Preferences 🍪</h2>
      <p class="subtitle">
        Choose how you want to use this site. Cookies and localStorage help us save your preferences and progress.
      </p>
    `;

    // Create cookie options
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

    // Add click handlers
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

    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Finish Setup';
    continueBtn.disabled = true;
    continueBtn.addEventListener('click', handleCookieConsentContinue);

    actions.appendChild(continueBtn);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(optionsContainer);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    return overlay;
  }

  function applyCookieConsent(accepted) {
    try {
      if (accepted) {
        // User accepted cookies
        localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
        // Cookies are already set from previous steps
      } else {
        // User declined cookies
        localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
        // Clear any cookies that were set
        try {
          // Clear cookies by setting them to expire
          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
          });
          // Clear relevant localStorage items except consent itself
          const itemsToKeep = [COOKIE_CONSENT_KEY, FIRST_VISIT_KEY];
          Object.keys(localStorage).forEach(key => {
            if (!itemsToKeep.includes(key)) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {
          console.error('Failed to clear storage:', e);
        }
      }
    } catch (e) {
      console.error('Failed to save cookie consent:', e);
    }
  }

  function handleCookieConsentContinue() {
    if (!selectedCookieOption) return;
    
    const accepted = selectedCookieOption === 'accept';
    applyCookieConsent(accepted);
    
    // Mark as visited FIRST to ensure localStorage is set before any redirects
    markAsVisited();
    
    // Close modal
    closeCookieConsentModal();
    
    // Check if cloaking is enabled and trigger it after modal closes
    try {
      const aboutBlankEnabled = localStorage.getItem(ABOUT_KEY);
      if (aboutBlankEnabled === 'true' && selectedDisguise) {
        // Wait for modal to close and localStorage to persist
        setTimeout(() => {
          // Double-check the flag is set before proceeding
          if (!localStorage.getItem(FIRST_VISIT_KEY)) {
            console.warn('First visit flag not set, setting again');
            localStorage.setItem(FIRST_VISIT_KEY, 'true');
          }
          
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
              iframe.src = window.location.origin;
              iframe.setAttribute('loading', 'eager');
              iframe.setAttribute('referrerpolicy', 'no-referrer');
              doc.body.style.margin = '0';
              doc.body.style.padding = '0';
              doc.body.style.overflow = 'hidden';
              doc.body.appendChild(iframe);

              // Store reference
              window._aboutWin = win;

              // Redirect current tab to disguise site after iframe loads
              setTimeout(() => {
                redirectToDisguiseSite();
              }, 500);
            } catch (err) {
              console.error('Failed to setup about:blank:', err);
            }
          }
        }, 400);
      }
    } catch (e) {
      console.error('Failed to check cloaking status:', e);
    }
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

  // === End Cookie Consent Modal ===

  function showFirstTimeModal() {
    // Wait for DOM to be fully loaded
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

  // Initialize: Check if first visit and show modal
  function init() {
    // Don't show modal if we're in an iframe (already cloaked in about:blank)
    if (window.self !== window.top) {
      return;
    }
    
    if (isFirstVisit()) {
      showFirstTimeModal();
    }
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for potential external use
  window.NexoraFirstTime = {
    showModal: showFirstTimeModal,
    isFirstVisit: isFirstVisit
  };
})();
