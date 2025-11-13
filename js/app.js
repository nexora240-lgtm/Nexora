const app = document.getElementById('app');

const routes = {
  '/home':     renderHome,
  '/games':    renderGamesRoute,
  '/movies':   renderMovies,
  '/proxy':    renderProxy,
  '/hacks':    renderHacks,
  '/chatbot':  renderChatbot,
  '/chatroom': renderChatroom,
  '/loader':   renderLoader,
  '/settings': renderSettings 
};

function navigate(path) {
  history.pushState({}, '', path);
  const renderFn = routes[path];
  if (renderFn) {
    renderFn();
  } else {
    renderHome();
  }
}

document.addEventListener('click', e => {
  const link = e.target.closest('[data-route]');
  if (link) {
    e.preventDefault();
    // Save chatroom state BEFORE navigation if currently on chatroom
    if (location.pathname === '/chatroom' && typeof window.saveChatroomState === 'function') {
      window.saveChatroomState();
    }
    navigate(link.dataset.route);
  }
});

window.onpopstate = () => {
  // Save chatroom state before back/forward navigation
  if (location.pathname === '/chatroom' && typeof window.saveChatroomState === 'function') {
    window.saveChatroomState();
  }
  const path = location.pathname;
  (routes[path] || renderHome)();
};

const initialPath = location.pathname;
(routes[initialPath] || renderHome)();

function renderHome()        { loadView('home.html'); }
function renderMovies()      { loadView('movies.html'); }
function renderProxy()       { loadView('proxy.html'); }
function renderHacks()       { loadView('hacks.html'); }
function renderChatbot()     { loadView('chatbot.html'); }
function renderChatroom()    { loadView('chatroom.html'); }
function renderLoader()      { loadView('gameloader.html'); }
function renderGamesRoute()  { loadView('games.html'); }
function renderSettings()    { loadView('settings.html'); } // ✅ New
