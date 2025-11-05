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

      scripts.forEach(s => {
        const newScript = document.createElement('script');
        if (s.src) {
          newScript.src = s.src;
          newScript.async = false;
        } else {
          newScript.textContent = s.textContent;
        }
        document.body.appendChild(newScript);
      });

      if (window.NexoraChat && typeof window.NexoraChat.init === 'function') {
        try { window.NexoraChat.init(app); } catch (e) { /* ignore init errors */ }
      }
    })
    .catch(() => {
      app.innerHTML = `
        <h1 class="site-title">Error</h1>
        <p>Failed to load ${file}.</p>
      `;
    });
}

function renderHome()     { loadView('home.html'); }
function renderGames()    { loadView('games.html'); }
function renderMovies()   { loadView('movies.html'); }
function renderProxy()    { loadView('proxy.html'); }
function renderHacks()    { loadView('hacks.html'); }
function renderChatbot()  { loadView('chatbot.html'); }
function renderSettings() { loadView('settings.html'); }
