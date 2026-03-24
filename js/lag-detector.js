(function () {
  var DISMISSED_KEY = 'nexora_lag_dismissed';
  var PRESET_KEY = 'settings.performancePreset';

  console.log('[LagDetector] script loaded');

  // Don't run inside about:blank iframes
  if (window.self !== window.top) {
    console.log('[LagDetector] bailed — running inside an iframe');
    return;
  }

  // Don't show if user has dismissed permanently
  try {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') {
      console.log('[LagDetector] bailed — dismissed by user (nexora_lag_dismissed=true). Run: localStorage.removeItem("nexora_lag_dismissed") then reload.');
      return;
    }
  } catch (e) {}

  // Don't show if already on the lowest (fast) preset
  try {
    if (localStorage.getItem(PRESET_KEY) === 'fast') {
      console.log('[LagDetector] bailed — already on fast preset');
      return;
    }
  } catch (e) {}

  // ─── Tuning knobs ────────────────────────────────────────────────────────────
  // How many frames to keep in the rolling window
  var SAMPLE_WINDOW    = 60;
  // A frame is considered "lagging" if it takes longer than this (ms)
  // 33 ms ≈ 30 fps  |  50 ms ≈ 20 fps  |  100 ms ≈ 10 fps
  var LAG_THRESHOLD_MS = 100;
  // Trigger the banner when this many frames out of SAMPLE_WINDOW are laggy
  // e.g. 30 out of 60 = 50% of frames must be slow
  var LAG_RATIO        = 0.50;
  // Wait this long after page load before measuring (ms) — avoids startup spikes
  var WARMUP_MS        = 4000;
  // ─────────────────────────────────────────────────────────────────────────────
  var LAG_CONSECUTIVE  = Math.round(SAMPLE_WINDOW * LAG_RATIO); // derived, don't edit

  var frameDeltas = [];
  var lastTime = null;
  var startTime = performance.now();
  var shown = false;
  var rafId = null;

  function onFrame(now) {
    if (shown) return; // stop once banner is shown

    if (lastTime !== null) {
      var delta = now - lastTime;
      // Ignore huge gaps (tab was hidden, etc.)
      if (delta < 2000) {
        frameDeltas.push(delta);
        if (frameDeltas.length > SAMPLE_WINDOW) {
          frameDeltas.shift();
        }
      }
    }
    lastTime = now;

    // Only evaluate after warmup period
    if (now - startTime >= WARMUP_MS && frameDeltas.length >= SAMPLE_WINDOW) {
      var lagCount = 0;
      for (var i = 0; i < frameDeltas.length; i++) {
        if (frameDeltas[i] > LAG_THRESHOLD_MS) lagCount++;
      }
      if (lagCount >= LAG_CONSECUTIVE) {
        shown = true;
        showLagBanner();
        return;
      }
    }

    rafId = requestAnimationFrame(onFrame);
  }

  // Pause measurement while tab is hidden
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTime = null; // reset so first frame after resume is clean
    } else if (!shown) {
      rafId = requestAnimationFrame(onFrame);
    }
  });

  // --- Debug helpers (usable from browser console) ---
  // window.__nexoraShowLagBanner()  → force-show the banner
  // window.__nexoraLagDebug()       → print current detector state
  window.__nexoraShowLagBanner = function () { shown = true; showLagBanner(); };
  window.__nexoraLagDebug = function () {
    var dismissed = localStorage.getItem(DISMISSED_KEY);
    var preset = localStorage.getItem(PRESET_KEY);
    console.log('[LagDetector] dismissed:', dismissed, '| preset:', preset,
      '| shown:', shown, '| frames collected:', frameDeltas.length,
      '| LAG_CONSECUTIVE:', LAG_CONSECUTIVE,
      '| sample avg ms:', frameDeltas.length
        ? (frameDeltas.reduce(function(a,b){return a+b;},0)/frameDeltas.length).toFixed(2)
        : 'n/a');
  };

  // Start after warmup so the initial page load burst doesn't count
  setTimeout(function () {
    if (!shown) {
      console.log('[LagDetector] started — waiting for', SAMPLE_WINDOW, 'frames (WARMUP_MS:', WARMUP_MS, ')');
      rafId = requestAnimationFrame(onFrame);
    }
  }, 500);

  // --- Banner UI ---
  function showLagBanner() {
    // Re-check dismissal & preset in case they changed while page was open
    try {
      if (localStorage.getItem(DISMISSED_KEY) === 'true') return;
      if (localStorage.getItem(PRESET_KEY) === 'fast') return;
    } catch (e) {}

    if (document.getElementById('nexora-lag-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'nexora-lag-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:999990',
      'max-width:340px',
      'width:calc(100% - 40px)',
      'background:var(--surface-2,#1e1e2e)',
      'border:1px solid var(--primary-accent,#f59e0b)',
      'border-radius:var(--radius,12px)',
      'padding:16px 18px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.45)',
      'font-family:"Poppins",Arial,sans-serif',
      'font-size:13px',
      'color:var(--text,#f1f5f9)',
      'backdrop-filter:blur(12px)',
      '-webkit-backdrop-filter:blur(12px)',
      'opacity:0',
      'transform:translateY(12px)',
      'transition:opacity 0.35s ease, transform 0.35s ease',
      'box-sizing:border-box'
    ].join(';');

    banner.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
        '<span style="font-size:20px;line-height:1;flex-shrink:0;margin-top:1px">⚠️</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:13.5px;margin-bottom:3px;color:var(--text,#f1f5f9)">' +
            'Your device seems to be lagging' +
          '</div>' +
          '<div style="color:var(--muted,#94a3b8);font-size:12px;line-height:1.45">' +
            'Consider switching to a lower performance preset to improve speed.' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button id="nexora-lag-presets-btn" style="' +
              'flex:1;padding:7px 0;border:none;border-radius:7px;cursor:pointer;' +
              'background:var(--primary-accent,#f59e0b);color:#000;' +
              'font-family:inherit;font-size:12px;font-weight:700' +
            '">Presets</button>' +
            '<button id="nexora-lag-dismiss-btn" style="' +
              'flex:1;padding:7px 0;border:1px solid var(--muted,#475569);border-radius:7px;cursor:pointer;' +
              'background:transparent;color:var(--muted,#94a3b8);' +
              'font-family:inherit;font-size:12px;font-weight:600' +
            '">Don\'t Show Again</button>' +
          '</div>' +
        '</div>' +
        '<button id="nexora-lag-close-btn" aria-label="Close" style="' +
          'background:none;border:none;cursor:pointer;padding:2px 4px;' +
          'color:var(--muted,#94a3b8);font-size:16px;line-height:1;flex-shrink:0;margin-top:-2px' +
        '">&times;</button>' +
      '</div>';

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
      });
    });

    function removeBanner() {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(12px)';
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 350);
    }

    document.getElementById('nexora-lag-close-btn').addEventListener('click', function () {
      removeBanner();
    });

    document.getElementById('nexora-lag-dismiss-btn').addEventListener('click', function () {
      try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch (e) {}
      removeBanner();
    });

    document.getElementById('nexora-lag-presets-btn').addEventListener('click', function () {
      removeBanner();
      // Navigate to settings appearance tab
      if (typeof window.navigate === 'function') {
        window.navigate('/settings');
        // Wait for the settings view to render, then activate the appearance tab
        setTimeout(function () {
          var tab = document.querySelector('[data-target="appearance"]');
          if (tab) tab.click();
        }, 120);
      }
    });
  }
})();
