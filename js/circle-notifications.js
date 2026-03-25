(function () {
  'use strict';

  var MAX_VISIBLE = 5;
  var AUTO_DISMISS_MS = 6000;
  var container = null;

  function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.className = 'circle-notif-container';
    document.body.appendChild(container);
    return container;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function dismiss(el) {
    if (el._dismissed) return;
    el._dismissed = true;
    clearTimeout(el._autoTimer);
    el.classList.add('circle-notif-out');
    el.addEventListener('animationend', function () {
      el.remove();
    });
  }

  function dismissAll() {
    if (!container) return;
    var items = container.querySelectorAll('.circle-notif:not(.circle-notif-out)');
    for (var i = 0; i < items.length; i++) {
      dismiss(items[i]);
    }
  }

  function show(username, message) {
    // Don't show if we're already on the chatroom page
    if (location.pathname === '/chatroom') return;

    var wrap = ensureContainer();

    // Limit visible notifications
    var existing = wrap.querySelectorAll('.circle-notif:not(.circle-notif-out)');
    if (existing.length >= MAX_VISIBLE) {
      dismiss(existing[0]);
    }

    var el = document.createElement('div');
    el.className = 'circle-notif';

    var firstLetter = (username && username.length > 0) ? username.charAt(0) : '?';

    el.innerHTML =
      '<div class="circle-notif-avatar">' + escapeHtml(firstLetter) + '</div>' +
      '<div class="circle-notif-body">' +
        '<div class="circle-notif-username">' + escapeHtml(username) + '</div>' +
        '<div class="circle-notif-text">' + escapeHtml(message) + '</div>' +
      '</div>' +
      '<button class="circle-notif-close" aria-label="Dismiss">&times;</button>';

    // Click notification body → navigate to circles
    el.addEventListener('click', function (e) {
      if (e.target.closest('.circle-notif-close')) return;
      dismiss(el);
      if (typeof window.navigate === 'function') {
        window.navigate('/chatroom');
      }
    });

    // X button → just dismiss
    el.querySelector('.circle-notif-close').addEventListener('click', function (e) {
      e.stopPropagation();
      dismiss(el);
    });

    wrap.appendChild(el);

    // Auto-dismiss after timeout
    el._autoTimer = setTimeout(function () {
      dismiss(el);
    }, AUTO_DISMISS_MS);
  }

  // Listen for custom events dispatched by chatroom.js
  document.addEventListener('circle:notification', function (e) {
    if (e.detail && e.detail.username && e.detail.message) {
      show(e.detail.username, e.detail.message);
    }
  });

  // Expose for direct calls if needed
  window.NexoraCircleNotifications = { show: show, dismissAll: dismissAll };
})();
