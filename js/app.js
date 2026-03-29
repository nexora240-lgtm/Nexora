const app = document.getElementById('app');

const routes = {
  '/home':      renderHome,
  '/games':     renderGamesRoute,
  '/movies':    renderMovies,
  '/apps':      renderApps,
  '/apploader': renderAppLoader,
  '/proxy':     renderProxy,
  '/hacks':     renderHacks,
  '/chatbot':   renderChatbot,
  '/chatroom':  renderChatroom,
  '/loader':    renderLoader,
  '/links':     renderLinkFinder,
  '/settings':  renderSettings,
  '/admin':     renderAdmin
};

function navigate(path) {
  history.pushState({}, '', path);
  const routeKey = path.split('?')[0];

  if (routeKey === '/chatroom' && window.NexoraCircleNotifications) {
    window.NexoraCircleNotifications.dismissAll();
  }

  const renderFn = routes[routeKey];
  if (renderFn) {
    renderFn();
  } else {
    renderHome();
  }
}

// Expose navigate globally for dynamically loaded views
window.navigate = navigate;

document.addEventListener('click', e => {
  const link = e.target.closest('[data-route]');
  if (link) {
    e.preventDefault();

    if (location.pathname === '/chatroom' && typeof window.saveChatroomState === 'function') {
      window.saveChatroomState();
    }
    navigate(link.dataset.route);
  }
});

window.onpopstate = () => {

  if (location.pathname === '/chatroom' && typeof window.saveChatroomState === 'function') {
    window.saveChatroomState();
  }
  const path = location.pathname;
  (routes[path] || renderHome)();
};

const urlParams = new URLSearchParams(window.location.search);
const redirectRoute = urlParams.get('route');

if (redirectRoute) {
  urlParams.delete('route');
  const remainingParams = urlParams.toString();
  const newUrl = redirectRoute + (remainingParams ? '?' + remainingParams : '');
  window.history.replaceState({}, '', newUrl);
  (routes[redirectRoute] || renderHome)();
} else {
  const initialPath = location.pathname;
  (routes[initialPath] || renderHome)();
}

function renderHome()        { loadView('home.html'); }
function renderMovies()      { loadView('movies.html'); }
function renderApps()        { loadView('apps.html'); }
function renderAppLoader()   { loadView('apploader.html'); }
function renderProxy()       { loadView('proxy.html'); }
function renderHacks()       { loadView('hacks.html'); }
function renderChatbot()     { loadView('chatbot.html'); }
function renderChatroom()    { loadView('chatroom.html'); }
function renderLoader()      { loadView('gameloader.html'); }
function renderGamesRoute()  { loadView('games.html'); }
function renderLinkFinder()  { loadView('linkfinder.html'); }
function renderSettings()    { loadView('settings.html'); }
function renderAdmin()       { loadView('admin.html'); }
