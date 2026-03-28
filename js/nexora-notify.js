(function () {
  'use strict';

  var MAX_VISIBLE = 5;
  var DEFAULT_DURATION = 4000;
  var containers = {};
  var activeNotifs = [];
  var idCounter = 0;

  // ── Helpers ──

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getContainer(position) {
    if (containers[position] && document.body.contains(containers[position])) {
      return containers[position];
    }
    var el = document.createElement('div');
    el.className = 'nxn-container nxn-' + position;
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
    containers[position] = el;
    return el;
  }

  function getPosition(opts) {
    if (opts.position) return opts.position;
    // Defaults by type
    switch (opts.type) {
      case 'message': return 'bottom-right';
      case 'announce': return 'bottom-right';
      case 'banner': return 'top-center';
      default: return 'bottom-right';
    }
  }

  // ── Dismiss ──

  function dismiss(notif) {
    if (notif._dismissed) return;
    notif._dismissed = true;
    clearTimeout(notif._autoTimer);
    notif.el.classList.add('nxn-out');

    var handler = function () {
      if (notif.el.parentNode) notif.el.remove();
      var idx = activeNotifs.indexOf(notif);
      if (idx !== -1) activeNotifs.splice(idx, 1);
    };

    notif.el.addEventListener('animationend', handler);
    // Fallback if animationend doesn't fire
    setTimeout(handler, 400);
  }

  function dismissAll(position) {
    var toDismiss = position
      ? activeNotifs.filter(function (n) { return n.position === position; })
      : activeNotifs.slice();
    toDismiss.forEach(function (n) { dismiss(n); });
  }

  function dismissById(id) {
    var notif = activeNotifs.find(function (n) { return n.id === id; });
    if (notif) dismiss(notif);
  }

  // ── Enforce max visible per position ──

  function enforceLimit(position) {
    var posNotifs = activeNotifs.filter(function (n) {
      return n.position === position && !n._dismissed;
    });
    while (posNotifs.length >= MAX_VISIBLE) {
      dismiss(posNotifs.shift());
    }
  }

  // ── Core show ──

  function show(opts) {
    if (typeof opts === 'string') {
      opts = { message: opts };
    }

    var type = opts.type || 'info';         // info | success | error | warning | message | announce | banner
    var position = getPosition(opts);
    var duration = opts.duration !== undefined ? opts.duration : DEFAULT_DURATION;
    var dismissible = opts.dismissible !== false;
    var icon = opts.icon || null;
    var title = opts.title || null;
    var message = opts.message || '';
    var onClick = opts.onClick || null;
    var className = opts.className || '';
    var html = opts.html || null;           // custom inner HTML (for advanced content)

    enforceLimit(position);

    var container = getContainer(position);
    var id = ++idCounter;

    var el = document.createElement('div');
    el.className = 'nxn nxn-' + type + (className ? ' ' + className : '');
    el.setAttribute('role', 'alert');

    // Build content
    var content = '';

    if (html) {
      // Custom html — caller is responsible for including .nxn-close if wanted,
      // but we must NOT add a second one here.
      content = html;
    } else {
      // Icon
      if (icon) {
        content += '<div class="nxn-icon">' + icon + '</div>';
      } else {
        var defaultIcon = getDefaultIcon(type);
        if (defaultIcon) {
          content += '<div class="nxn-icon">' + defaultIcon + '</div>';
        }
      }

      // Body
      content += '<div class="nxn-body">';
      if (title) {
        content += '<div class="nxn-title">' + escapeHtml(title) + '</div>';
      }
      if (message) {
        content += '<div class="nxn-text">' + escapeHtml(message) + '</div>';
      }
      content += '</div>';

      // Close button (only for the non-html path)
      if (dismissible) {
        content += '<button class="nxn-close" aria-label="Dismiss">&times;</button>';
      }
    }

    el.innerHTML = content;

    // Wire up notif object first so the close handler can reference it
    var notif = {
      id: id,
      el: el,
      position: position,
      type: type,
      _dismissed: false,
      _autoTimer: null
    };

    // Always wire .nxn-close — whether it came from html or was built above
    var closeBtn = el.querySelector('.nxn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        dismiss(notif);
      });
    }

    if (onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        if (e.target.closest('.nxn-close')) return;
        onClick(notif);
        dismiss(notif);
      });
    }

    container.appendChild(el);

    activeNotifs.push(notif);

    // Auto-dismiss (0 = no auto-dismiss)
    if (duration > 0) {
      notif._autoTimer = setTimeout(function () {
        dismiss(notif);
      }, duration);
    }

    return notif;
  }

  // ── Default icons ──

  function getDefaultIcon(type) {
    switch (type) {
      case 'success': return '<i class="fas fa-check-circle"></i>';
      case 'error':   return '<i class="fas fa-times-circle"></i>';
      case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
      case 'info':    return '<i class="fas fa-info-circle"></i>';
      case 'announce': return '<i class="fas fa-bullhorn"></i>';
      default: return '';
    }
  }

  // ── Convenience methods ──

  function success(message, opts) {
    return show(Object.assign({ type: 'success', message: message }, opts || {}));
  }

  function error(message, opts) {
    return show(Object.assign({ type: 'error', message: message }, opts || {}));
  }

  function warning(message, opts) {
    return show(Object.assign({ type: 'warning', message: message }, opts || {}));
  }

  function info(message, opts) {
    return show(Object.assign({ type: 'info', message: message }, opts || {}));
  }

  // Circle chat notification
  function circleMessage(username, message) {
    if (location.pathname === '/chatroom') return null;

    var firstLetter = (username && username.length > 0) ? username.charAt(0) : '?';

    return show({
      type: 'message',
      position: 'bottom-right',
      duration: 6000,
      html:
        '<div class="nxn-avatar">' + escapeHtml(firstLetter) + '</div>' +
        '<div class="nxn-body">' +
          '<div class="nxn-title">' + escapeHtml(username) + '</div>' +
          '<div class="nxn-text">' + escapeHtml(message) + '</div>' +
        '</div>' +
        '<button class="nxn-close" aria-label="Dismiss">&times;</button>',
      onClick: function () {
        if (typeof window.navigate === 'function') {
          window.navigate('/chatroom');
        }
      }
    });
  }

  // Announcement notification
  function announce(title, message, opts) {
    return show(Object.assign({
      type: 'announce',
      title: title,
      message: message,
      duration: 0,  // manual dismiss only
      position: 'bottom-right'
    }, opts || {}));
  }

  // Banner notification (top center, like popup-blocked)
  function banner(message, opts) {
    return show(Object.assign({
      type: 'banner',
      message: message,
      position: 'top-center',
      duration: 10000
    }, opts || {}));
  }

  // Listen for circle:notification events (backward compat)
  document.addEventListener('circle:notification', function (e) {
    if (e.detail && e.detail.username && e.detail.message) {
      circleMessage(e.detail.username, e.detail.message);
    }
  });

  // ── Public API ──

  window.NexoraNotify = {
    show: show,
    success: success,
    error: error,
    warning: warning,
    info: info,
    circleMessage: circleMessage,
    announce: announce,
    banner: banner,
    dismiss: dismissById,
    dismissAll: dismissAll
  };

  // Backward compatibility
  window.NexoraCircleNotifications = {
    show: circleMessage,
    dismissAll: function () { dismissAll('bottom-right'); }
  };
})();
