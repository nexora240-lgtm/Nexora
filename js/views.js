const VIEW_CLASS_PREFIX = 'view-';
let currentViewAssets = [];

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
  
  fetch('/' + file)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const viewName = normalizeViewName(file);

      const previousAssets = currentViewAssets;
      const newAssets = [];

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

      previousAssets.forEach(node => {
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
      currentViewAssets = newAssets;

      const scripts = doc.body ? Array.from(doc.body.querySelectorAll('script')) : [];
      scripts.forEach(s => s.remove());

      app.innerHTML = doc.body ? doc.body.innerHTML : '';
      setActiveViewClass(file);

      loadScriptsSequentially(scripts)
        .catch(err => console.error('Failed to load view scripts', err));

      if (window.NexoraChat && typeof window.NexoraChat.init === 'function') {
        try { window.NexoraChat.init(app); } catch (e) {  }
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
