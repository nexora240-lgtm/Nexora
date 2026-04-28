/**
 * Nexora storage shim — must run BEFORE any other script.
 *
 * Some browsers (Edge with strict tracking prevention, sandboxed iframes,
 * some private-mode windows) make even *reading* `window.localStorage`
 * throw a SecurityError. That breaks every script that touches storage —
 * including this site's config.js, auth.js, app.js, and many inline
 * snippets. Wrapping every single call site in try/catch is impractical
 * (200+ usages), so instead this shim transparently replaces the two
 * Storage objects with an in-memory implementation when the native ones
 * are unavailable.
 *
 * If native storage works, this shim does nothing.
 */
(function () {
  'use strict';

  function probe(kind) {
    try {
      var s = window[kind];
      if (!s) return false;
      var k = '__nx_storage_probe__';
      s.setItem(k, '1');
      s.removeItem(k);
      return true;
    } catch (_) {
      return false;
    }
  }

  // In-memory Storage implementation that matches the Web Storage API.
  function makeMemoryStorage() {
    var data = Object.create(null);
    var api = {
      get length() {
        return Object.keys(data).length;
      },
      key: function (i) {
        var keys = Object.keys(data);
        return i >= 0 && i < keys.length ? keys[i] : null;
      },
      getItem: function (k) {
        k = String(k);
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem: function (k, v) {
        data[String(k)] = String(v);
      },
      removeItem: function (k) {
        delete data[String(k)];
      },
      clear: function () {
        data = Object.create(null);
      },
    };
    return api;
  }

  function install(kind) {
    if (probe(kind)) return false; // native works fine
    var shim = makeMemoryStorage();
    try {
      Object.defineProperty(window, kind, {
        value: shim,
        configurable: true,
        writable: false,
      });
    } catch (_) {
      // Last resort: assign directly. Some browsers still allow this.
      try { window[kind] = shim; } catch (__) {}
    }
    return true;
  }

  var fixedLocal = install('localStorage');
  var fixedSession = install('sessionStorage');

  if (fixedLocal || fixedSession) {
    // Single console line so devs know what's going on.
    try {
      console.warn(
        '[NexoraStorageShim] Browser blocked native ' +
        (fixedLocal && fixedSession ? 'localStorage + sessionStorage'
          : fixedLocal ? 'localStorage' : 'sessionStorage') +
        '. Using in-memory fallback (data will not persist this session).'
      );
    } catch (_) { /* ignore */ }
  }
})();
