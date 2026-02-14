const VIEW_CLASS_PREFIX = 'view-';
let currentViewAssets = [];

// GameStateManager - tracks game state for "Continue Playing" feature
window.GameStateManager = {
  STORAGE_KEY: 'nexora_gameInProgress',
  AUTOPLAY_KEY: 'nexora_autoplayGame',
  DOM_STATE_KEY: 'nexora_gameDomState',

  // Save game state when game starts playing
  saveState(gameData) {
    const state = {
      game: gameData,
      timestamp: Date.now(),
      isPlaying: true
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  },

  // Get saved game state
  getState() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  },

  // Check if there's an active game
  hasActiveGame() {
    const state = this.getState();
    return state && state.isPlaying;
  },

  // Clear the game state (when user explicitly closes/finishes)
  clearState() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  // Mark game as no longer playing but keep data for potential resume
  pauseState() {
    const state = this.getState();
    if (state) {
      state.isPlaying = false;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
  },

  // Set flag to auto-play game on loader (skip "Play Now" button)
  setAutoplay(shouldAutoplay) {
    if (shouldAutoplay) {
      sessionStorage.setItem(this.AUTOPLAY_KEY, 'true');
    } else {
      sessionStorage.removeItem(this.AUTOPLAY_KEY);
    }
  },

  // Check and consume autoplay flag
  shouldAutoplay() {
    const autoplay = sessionStorage.getItem(this.AUTOPLAY_KEY);
    if (autoplay === 'true') {
      sessionStorage.removeItem(this.AUTOPLAY_KEY);
      return true;
    }
    return false;
  },

  // Track whether the game iframe DOM is currently alive (mounted or stashed)
  markDomActive() {
    sessionStorage.setItem(this.DOM_STATE_KEY, 'active');
  },

  markDomDormant() {
    sessionStorage.setItem(this.DOM_STATE_KEY, 'dormant');
  },

  clearDomState() {
    sessionStorage.removeItem(this.DOM_STATE_KEY);
  },

  hasDom() {
    const state = sessionStorage.getItem(this.DOM_STATE_KEY);
    return state === 'active' || state === 'dormant';
  }
};

function clearViewAssets() {
  currentViewAssets.forEach(node => {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
  currentViewAssets = [];
}

function normalizeViewName(file) {
  if (!file) return 'default';
  return file.replace(/\.html$/i, '').replace(/[^a-z0-9\-]/gi, '-') || 'default';
}

function setActiveViewClass(file) {
  const viewClass = `${VIEW_CLASS_PREFIX}${normalizeViewName(file)}`;
  Array.from(document.body.classList)
    .filter(cls => cls.startsWith(VIEW_CLASS_PREFIX))
    .forEach(cls => document.body.classList.remove(cls));
  document.body.classList.add(viewClass);
}

const PERSISTENT_VIEWS = {
  'gameloader.html': {
    stash: null,
    assets: [],
    isMounted: false,
  }
};

let activePersistentView = null;

function ensurePersistentStash(file) {
  const config = PERSISTENT_VIEWS[file];
  if (!config) return null;
  if (!config.stash) {
    const stash = document.createElement('div');
    stash.id = `stash-${normalizeViewName(file)}`;
    stash.style.display = 'none';
    stash.setAttribute('aria-hidden', 'true');
    document.body.appendChild(stash);
    config.stash = stash;
  }
  return config.stash;
}

function stashPersistentView(file) {
  const config = PERSISTENT_VIEWS[file];
  if (!config || !config.isMounted) return;
  const stash = ensurePersistentStash(file);
  if (!stash) return;
  while (app.firstChild) {
    stash.appendChild(app.firstChild);
  }
  config.isMounted = false;
  if (activePersistentView === file) {
    activePersistentView = null;
  }
  if (window.GameStateManager) {
    window.GameStateManager.markDomDormant();
  }
}

function restorePersistentView(file) {
  const config = PERSISTENT_VIEWS[file];
  if (!config || !config.stash || !config.stash.childNodes.length) {
    return false;
  }
  app.innerHTML = '';
  while (config.stash.firstChild) {
    app.appendChild(config.stash.firstChild);
  }
  config.isMounted = true;
  activePersistentView = file;
  if (window.GameStateManager) {
    window.GameStateManager.markDomActive();
    window.GameStateManager.setAutoplay(false);
  }
  return true;
}

function destroyPersistentView(file) {
  const config = PERSISTENT_VIEWS[file];
  if (!config) return;

  if (config.isMounted && activePersistentView === file) {
    while (app.firstChild) {
      app.removeChild(app.firstChild);
    }
    config.isMounted = false;
    activePersistentView = null;
  }

  if (config.stash) {
    config.stash.replaceChildren();
    config.stash.remove();
    config.stash = null;
  }

  if (config.assets && config.assets.length) {
    config.assets.forEach(node => {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    config.assets = [];
  }

  if (window.GameStateManager) {
    window.GameStateManager.clearDomState();
    window.GameStateManager.setAutoplay(false);
  }
}

window.destroyGameSession = function () {
  destroyPersistentView('gameloader.html');
  if (window.GameStateManager) {
    window.GameStateManager.clearState();
  }
  try {
    sessionStorage.removeItem('currentGame');
  } catch (e) {}
  // Show the app container again
  if (app) {
    app.style.display = 'block';
  }
};

// Clear game session when user leaves the website
window.addEventListener('beforeunload', function() {
  if (window.GameStateManager) {
    window.GameStateManager.clearState();
    window.GameStateManager.clearDomState();
  }
  try {
    sessionStorage.removeItem('currentGame');
  } catch (e) {}
});

// Helper function to suspend all audio in an iframe (same-origin only)
function suspendIframeAudio(iframe) {
  try {
    const iframeWindow = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument;
    if (iframeWindow && iframeDoc) {
      // Dispatch a fake visibilitychange event to trigger the game's pause logic
      Object.defineProperty(iframeDoc, 'hidden', { value: true, writable: true, configurable: true });
      Object.defineProperty(iframeDoc, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      iframeDoc.dispatchEvent(new Event('visibilitychange'));
      
      // Also directly suspend any AudioContexts we can find
      if (iframeWindow._audioContexts) {
        iframeWindow._audioContexts.forEach(ctx => {
          if (ctx && ctx.state === 'running') {
            ctx.suspend();
          }
        });
      }
      // Pause all audio/video elements
      iframeDoc.querySelectorAll('audio, video').forEach(el => {
        if (!el.paused) {
          el.dataset.wasPlaying = 'true';
          el.pause();
        }
      });
    }
  } catch (e) {
    // Cross-origin - can't access
    console.log('Cannot suspend iframe audio (cross-origin):', e);
  }
}

// Helper function to resume all audio in an iframe (same-origin only)
function resumeIframeAudio(iframe) {
  try {
    const iframeWindow = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument;
    if (iframeWindow && iframeDoc) {
      // Dispatch a fake visibilitychange event to trigger the game's resume logic
      Object.defineProperty(iframeDoc, 'hidden', { value: false, writable: true, configurable: true });
      Object.defineProperty(iframeDoc, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      iframeDoc.dispatchEvent(new Event('visibilitychange'));
      
      // Also directly resume any AudioContexts
      if (iframeWindow._audioContexts) {
        iframeWindow._audioContexts.forEach(ctx => {
          if (ctx && ctx.state === 'suspended') {
            ctx.resume();
          }
        });
      }
      // Resume media elements that were playing
      iframeDoc.querySelectorAll('audio, video').forEach(el => {
        if (el.dataset.wasPlaying === 'true') {
          el.play();
          delete el.dataset.wasPlaying;
        }
      });
    }
  } catch (e) {
    // Cross-origin - can't access
    console.log('Cannot resume iframe audio (cross-origin):', e);
  }
}

function loadView(file) {
  // Call cleanup functions before loading new view
  if (typeof window.moviesCleanup === 'function') {
    window.moviesCleanup();
    window.moviesCleanup = null;
  }
  
  if (typeof window.gamesCleanup === 'function') {
    window.gamesCleanup();
    window.gamesCleanup = null;
  }

  const persistentConfig = PERSISTENT_VIEWS[file];

  // If switching to a persistent view
  if (persistentConfig) {
    // Hide all other persistent views first
    for (const [viewFile, config] of Object.entries(PERSISTENT_VIEWS)) {
      if (viewFile !== file && config.stash) {
        // Suspend audio in all iframes before hiding
        const iframes = config.stash.querySelectorAll('iframe');
        iframes.forEach(iframe => suspendIframeAudio(iframe));
        
        config.stash.style.display = 'none';
        config.stash.style.visibility = 'hidden';
        config.stash.style.pointerEvents = 'none';
      }
    }

    // If the persistent view is already mounted in stash, show it
    if (persistentConfig.stash && persistentConfig.stash.childNodes.length > 0) {
      app.style.display = 'none';
      // Temporarily hide for smooth transition
      persistentConfig.stash.classList.add('view-loading');
      
      // Restore to visible state
      persistentConfig.stash.style.display = 'block';
      persistentConfig.stash.style.visibility = 'visible';
      persistentConfig.stash.style.pointerEvents = 'auto';
      persistentConfig.stash.style.removeProperty('aria-hidden');
      
      // Resume audio in all iframes after showing
      const iframes = persistentConfig.stash.querySelectorAll('iframe');
      iframes.forEach(iframe => resumeIframeAudio(iframe));
      
      setActiveViewClass(file);
      if (window.GameStateManager) {
        window.GameStateManager.markDomActive();
      }
      
      // Remove loading class for smooth fade-in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          persistentConfig.stash.classList.remove('view-loading');
        });
      });
      return;
    }
  } else {
    // Hide all persistent views when loading a non-persistent view
    for (const [viewFile, config] of Object.entries(PERSISTENT_VIEWS)) {
      if (config.stash) {
        // Suspend audio in all iframes before hiding
        const iframes = config.stash.querySelectorAll('iframe');
        iframes.forEach(iframe => suspendIframeAudio(iframe));
        
        config.stash.style.display = 'none';
        config.stash.style.visibility = 'hidden';
        config.stash.style.pointerEvents = 'none';
        config.stash.setAttribute('aria-hidden', 'true');
      }
    }
    app.style.display = 'block';
  }

  // Remove assets for the previous non-persistent view
  clearViewAssets();
  
  // Add loading class to prevent FOUC
  const targetContainer = persistentConfig ? (persistentConfig.stash || app) : app;
  targetContainer.classList.add('view-loading');
  
  fetch('/' + file)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const viewName = normalizeViewName(file);
      const newAssets = [];
      const cssLinkPromises = [];

      const headNodes = doc.head ? Array.from(doc.head.querySelectorAll('link, style')) : [];
      headNodes.forEach(node => {
        if (node.tagName === 'LINK' && node.href) {
          const existing = document.head.querySelector(`link[href="${node.href}"]`);
          if (existing && !existing.dataset.viewAsset) {
            return;
          }
          const newLink = document.createElement('link');
          Array.from(node.attributes).forEach(a => newLink.setAttribute(a.name, a.value));
          newLink.dataset.viewAsset = viewName;
          
          // Create promise to wait for CSS to load
          const loadPromise = new Promise((resolve) => {
            newLink.addEventListener('load', resolve, { once: true });
            newLink.addEventListener('error', resolve, { once: true }); // Resolve on error too
            // Timeout fallback in case load event doesn't fire
            setTimeout(resolve, 100);
          });
          cssLinkPromises.push(loadPromise);
          
          document.head.appendChild(newLink);
          newAssets.push(newLink);
        } else if (node.tagName === 'STYLE') {
          const newStyle = document.createElement('style');
          newStyle.textContent = node.textContent;
          newStyle.dataset.viewAsset = viewName;
          document.head.appendChild(newStyle);
          newAssets.push(newStyle);
        }
      });

      if (!persistentConfig) {
        currentViewAssets = newAssets;
      } else {
        persistentConfig.assets = persistentConfig.assets.concat(newAssets);
      }

      const scripts = doc.body ? Array.from(doc.body.querySelectorAll('script')) : [];
      scripts.forEach(s => s.remove());

      if (persistentConfig) {
        // Create/get the stash container for persistent views
        if (!persistentConfig.stash) {
          const stash = document.createElement('div');
          stash.id = `stash-${normalizeViewName(file)}`;
          stash.style.position = 'fixed';
          stash.style.top = '0';
          stash.style.left = '0';
          stash.style.right = '0';
          stash.style.bottom = '0';
          stash.style.width = '100%';
          stash.style.height = '100%';
          stash.style.overflow = 'auto';
          stash.style.zIndex = '1';
          stash.className = 'main-content';
          document.querySelector('.page-frame').appendChild(stash);
          persistentConfig.stash = stash;
        }
        persistentConfig.stash.innerHTML = doc.body ? doc.body.innerHTML : '';
        persistentConfig.stash.style.display = 'block';
        persistentConfig.stash.style.removeProperty('aria-hidden');
        app.style.display = 'none';
        persistentConfig.isMounted = true;
        if (window.GameStateManager) {
          window.GameStateManager.markDomActive();
        }
      } else {
        app.innerHTML = doc.body ? doc.body.innerHTML : '';
        app.style.display = 'block';
      }

      setActiveViewClass(file);

      // Wait for CSS to load before showing content
      Promise.all(cssLinkPromises).then(() => {
        // Small delay to ensure styles are applied
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            targetContainer.classList.remove('view-loading');
          });
        });
      });

      loadScriptsSequentially(scripts)
        .catch(err => console.error('Failed to load view scripts', err));

      if (window.NexoraChat && typeof window.NexoraChat.init === 'function') {
        try { window.NexoraChat.init(persistentConfig ? persistentConfig.stash : app); } catch (e) {  }
      }

      if (file === 'chatroom.html' && typeof restoreChatroomState === 'function') {
        // Use requestAnimationFrame for faster, smoother restoration
        requestAnimationFrame(() => {
          restoreChatroomState();
        });
      }
    })
    .catch(() => {
      clearViewAssets();
      setActiveViewClass('error');
      targetContainer.classList.remove('view-loading');
      app.innerHTML = `
        <h1 class="site-title">Error</h1>
        <p>Failed to load ${file}.</p>
      `;
    });
}

function loadScriptsSequentially(scripts) {
  // Group scripts: those with src and those without
  const inlineScripts = scripts.filter(s => !s.getAttribute('src'));
  const externalScripts = scripts.filter(s => s.getAttribute('src'));
  
  // Load external scripts in parallel, then inline scripts sequentially
  const externalPromises = externalScripts.map(scriptNode => appendScriptNode(scriptNode));
  
  return Promise.all(externalPromises).then(() => {
    // Then execute inline scripts sequentially after external scripts load
    return inlineScripts.reduce((chain, scriptNode) => {
      return chain.then(() => appendScriptNode(scriptNode));
    }, Promise.resolve());
  });
}

function appendScriptNode(scriptNode) {
  return new Promise(resolve => {
    const newScript = document.createElement('script');
    Array.from(scriptNode.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value);
    });

    const hasSrc = Boolean(scriptNode.getAttribute('src'));
    const isAsync = scriptNode.hasAttribute('async') || scriptNode.hasAttribute('defer') || scriptNode.getAttribute('type') === 'module';

    if (!hasSrc) {
      newScript.textContent = scriptNode.textContent;
      document.body.appendChild(newScript);
      resolve();
      return;
    }

    if (!isAsync) {
      newScript.async = false;
    }

    newScript.addEventListener('load', () => resolve(), { once: true });
    newScript.addEventListener('error', event => {
      console.error('Script failed to load:', scriptNode.getAttribute('src'), event);
      resolve();
    }, { once: true });

    document.body.appendChild(newScript);
  });
}

function renderHome()     { loadView('home.html'); }
function renderGames()    { loadView('games.html'); }
function renderMovies()   { loadView('movies.html'); }
function renderProxy()    { 
  // Proxy page requires full page reload due to service worker dependencies
  window.location.href = '/proxy.html';
}
function renderHacks()    { loadView('hacks.html'); }
function renderChatbot()  { loadView('chatbot.html'); }
function renderChatroom() { loadView('chatroom.html'); }
function renderSettings() { loadView('settings.html'); }
