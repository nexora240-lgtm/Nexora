const app = document.getElementById('app');

const routes = {
  '/home':     renderHome,
  '/games':    renderGamesRoute,
  '/movies':   renderMovies,
  '/proxy':    renderProxy,
  '/hacks':    renderHacks,
  '/chatbot':  renderChatbot,
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
    navigate(link.dataset.route);
  }
});

window.onpopstate = () => {
  const path = location.pathname;
  (routes[path] || renderHome)();
};

const initialPath = location.pathname;
(routes[initialPath] || renderHome)();

// Render functions
function renderHome()        { loadView('home.html'); }
function renderMovies()      { loadView('movies.html'); }
function renderProxy()       { loadView('proxy.html'); }
function renderHacks()       { loadView('hacks.html'); }
function renderChatbot()     { loadView('chatbot.html'); }
function renderLoader()      { loadView('gameloader.html'); }
function renderGamesRoute()  { loadView('games.html'); }
function renderSettings()    { loadView('settings.html'); } // ✅ New
