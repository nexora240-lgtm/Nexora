function loadView(file) {
  fetch('/' + file)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const headNodes = doc.head ? Array.from(doc.head.querySelectorAll('link, style')) : [];
      headNodes.forEach(node => {
        if (node.tagName === 'LINK' && node.href) {
          if (!document.querySelector(`link[href="${node.href}"]`)) {
            const newLink = document.createElement('link');
            Array.from(node.attributes).forEach(a => newLink.setAttribute(a.name, a.value));
            document.head.appendChild(newLink);
          }
        } else if (node.tagName === 'STYLE') {
          const newStyle = document.createElement('style');
          newStyle.textContent = node.textContent;
          document.head.appendChild(newStyle);
        }
      });

      const scripts = doc.body ? Array.from(doc.body.querySelectorAll('script')) : [];
      scripts.forEach(s => s.remove());

      app.innerHTML = doc.body ? doc.body.innerHTML : '';

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
