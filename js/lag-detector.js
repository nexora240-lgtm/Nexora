(function () {
  var DISMISSED_KEY = 'nexora_lag_dismissed';
  var PRESET_KEY = 'settings.performancePreset';

  console.log('[LagDetector] script loaded');

  if (window.self !== window.top) {
    console.log('[LagDetector] bailed — running inside an iframe');
    return;
  }

  try {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') {
      console.log('[LagDetector] bailed — dismissed by user (nexora_lag_dismissed=true). Run: localStorage.removeItem("nexora_lag_dismissed") then reload.');
      return;
    }
  } catch (e) {}

  try {
    if (localStorage.getItem(PRESET_KEY) === 'fast') {
      console.log('[LagDetector] bailed — already on fast preset');
      return;
    }
  } catch (e) {}

  // ─── Tuning knobs ────────────────────────────────────────────────────────────
  // Total score needed to show the banner
  var SCORE_THRESHOLD  = 5;

  // LCP thresholds (ms) — Largest Contentful Paint
  var LCP_WARN         = 1500;   // +2 pts
  var LCP_POOR         = 4000;   // +5 pts (instant trigger)

  // FCP thresholds (ms) — First Contentful Paint (earlier signal)
  var FCP_WARN         = 1800;   // +1 pt
  var FCP_POOR         = 3000;   // +3 pts

  // INP thresholds (ms) — worst interaction-to-next-paint latency
  var INP_WARN         = 200;    // +2 pts
  var INP_POOR         = 500;    // +5 pts (instant trigger)

  // TTFB thresholds (ms) — server + network latency from navigation timing
  var TTFB_WARN        = 800;    // +1 pt
  var TTFB_POOR        = 1800;   // +3 pts

  // TBT — Total Blocking Time: sum of (task_duration - 50ms) for all long tasks
  var TBT_WARN         = 300;    // +2 pts
  var TBT_POOR         = 600;    // +4 pts (replaces warn)

  // rAF: frame considered slow if longer than this (ms) — 42ms ≈ 24fps
  var RAF_THRESHOLD_MS = 42;
  var RAF_WINDOW       = 60;     // rolling window size in frames
  var RAF_RATIO        = 0.75;   // 75% of window must be slow to score
  // Re-evaluate every N frames after warmup; first hit = 3pts, subsequent = 1pt each
  var RAF_RECHECK_EVERY = 30;
  var RAF_MAX_PTS      = 5;      // rAF contribution cap

  // Wait before rAF evaluation starts (ms)
  var WARMUP_MS        = 10000;
  // ─────────────────────────────────────────────────────────────────────────────

  var score = 0;
  var shown = false;

  // Per-signal score caps to prevent double-counting
  var lcpScoreAdded  = 0;
  var fcpScoreAdded  = 0;
  var inpScoreAdded  = 0;
  var ttfbScoreAdded = 0;
  var tbtScoreAdded  = 0;
  var rafScoreAdded  = 0;

  function maybeShow(reason) {
    if (shown) return;
    if (score >= SCORE_THRESHOLD) {
      shown = true;
      console.log('[LagDetector] threshold reached (' + score + ' pts) — trigger:', reason);
      showLagBanner();
    }
  }

  function addScore(pts, cap, currentAdded, label) {
    // cap per-signal contribution; returns new total added for this signal
    var allowed = Math.min(pts, cap - currentAdded);
    if (allowed <= 0) return currentAdded;
    score += allowed;
    console.log('[LagDetector] +' + allowed + ' pts (' + label + ') → total', score);
    maybeShow(label);
    return currentAdded + allowed;
  }

  if ('PerformanceObserver' in window) {

    // ── 1. LCP — Largest Contentful Paint ─────────────────────────────────────
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var lcp = entries[entries.length - 1].startTime;
        var target = lcp >= LCP_POOR ? 5 : lcp >= LCP_WARN ? 2 : 0;
        if (target > lcpScoreAdded) {
          lcpScoreAdded = addScore(target - lcpScoreAdded, 5, lcpScoreAdded,
            'LCP ' + (lcp >= LCP_POOR ? 'poor' : 'warn') + ' (' + lcp.toFixed(0) + 'ms)');
        } else {
          console.log('[LagDetector] LCP good (' + lcp.toFixed(0) + 'ms)');
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { console.log('[LagDetector] LCP not supported'); }

    // ── 2. FCP — First Contentful Paint ───────────────────────────────────────
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          if (e.name !== 'first-contentful-paint') return;
          var fcp = e.startTime;
          var target = fcp >= FCP_POOR ? 3 : fcp >= FCP_WARN ? 1 : 0;
          if (target > fcpScoreAdded) {
            fcpScoreAdded = addScore(target - fcpScoreAdded, 3, fcpScoreAdded,
              'FCP ' + (fcp >= FCP_POOR ? 'poor' : 'warn') + ' (' + fcp.toFixed(0) + 'ms)');
          } else {
            console.log('[LagDetector] FCP good (' + fcp.toFixed(0) + 'ms)');
          }
        });
      }).observe({ type: 'paint', buffered: true });
    } catch (e) { console.log('[LagDetector] FCP not supported'); }

    // ── 3. CLS skipped — sidebar navigation causes false positives ────────────

    // ── 4. INP — interaction-to-next-paint latency ────────────────────────────
    // e.duration = full time from input start to next paint frame (correct INP measure)
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          var dur = e.duration; // correct: full input → next paint
          if (dur > (typeof worstInp !== 'undefined' ? worstInp : 0)) worstInp = dur;
        });
        var target = worstInp >= INP_POOR ? 5 : worstInp >= INP_WARN ? 2 : 0;
        if (target > inpScoreAdded) {
          inpScoreAdded = addScore(target - inpScoreAdded, 5, inpScoreAdded,
            'INP ' + (worstInp >= INP_POOR ? 'poor' : 'warn') + ' (' + worstInp.toFixed(0) + 'ms)');
        }
      }).observe({ type: 'event', durationThreshold: INP_WARN, buffered: true });
    } catch (e) { console.log('[LagDetector] INP not supported'); }
    var worstInp = 0;

    // ── 5. TBT — Total Blocking Time from long tasks ──────────────────────────
    // TBT = Σ(task_duration - 50ms) for every long task > 50ms
    var tbtAccum = 0;
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          tbtAccum += Math.max(0, e.duration - 50);
        });
        var target = tbtAccum >= TBT_POOR ? 4 : tbtAccum >= TBT_WARN ? 2 : 0;
        if (target > tbtScoreAdded) {
          tbtScoreAdded = addScore(target - tbtScoreAdded, 4, tbtScoreAdded,
            'TBT ' + (tbtAccum >= TBT_POOR ? 'poor' : 'warn') + ' (' + tbtAccum.toFixed(0) + 'ms)');
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch (e) { console.log('[LagDetector] longtask not supported'); }
  }

  // ── 6. TTFB from Navigation Timing (no observer needed) ──────────────────────
  function checkTTFB() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (!nav) return;
      var ttfb = nav.responseStart - nav.requestStart;
      var target = ttfb >= TTFB_POOR ? 3 : ttfb >= TTFB_WARN ? 1 : 0;
      if (target > 0) {
        ttfbScoreAdded = addScore(target, 3, ttfbScoreAdded,
          'TTFB ' + (ttfb >= TTFB_POOR ? 'poor' : 'warn') + ' (' + ttfb.toFixed(0) + 'ms)');
      } else {
        console.log('[LagDetector] TTFB good (' + ttfb.toFixed(0) + 'ms)');
      }
    } catch (e) {}
  }
  if (document.readyState === 'complete') {
    checkTTFB();
  } else {
    window.addEventListener('load', checkTTFB, { once: true });
  }

  // ── 7. rAF rolling frame-rate (ongoing monitor) ───────────────────────────────
  var frameDeltas = [];
  var lastTime = null;
  var startTime = performance.now();
  var rafId = null;
  var rafFramesSinceCheck = 0;

  function onFrame(now) {
    if (shown) return;
    if (lastTime !== null) {
      var delta = now - lastTime;
      if (delta < 2000) {
        frameDeltas.push(delta);
        if (frameDeltas.length > RAF_WINDOW) frameDeltas.shift();
      }
    }
    lastTime = now;

    if (now - startTime >= WARMUP_MS && frameDeltas.length >= RAF_WINDOW) {
      rafFramesSinceCheck++;
      if (rafFramesSinceCheck >= RAF_RECHECK_EVERY) {
        rafFramesSinceCheck = 0;
        var slow = 0;
        for (var i = 0; i < frameDeltas.length; i++) {
          if (frameDeltas[i] > RAF_THRESHOLD_MS) slow++;
        }
        var ratio = slow / frameDeltas.length;
        if (ratio >= RAF_RATIO && rafScoreAdded < RAF_MAX_PTS) {
          var pts = rafScoreAdded === 0 ? 3 : 1; // first hit = 3pts, each subsequent = 1pt
          rafScoreAdded = addScore(pts, RAF_MAX_PTS, rafScoreAdded,
            'rAF ' + (ratio * 100).toFixed(1) + '% slow frames');
        }
      }
    }

    rafId = requestAnimationFrame(onFrame);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      lastTime = null;
    } else if (!shown) {
      rafId = requestAnimationFrame(onFrame);
    }
  });

  // ── Debug helpers ──────────────────────────────────────────────────────────────
  window.__nexoraShowLagBanner = function () { shown = true; showLagBanner(); };
  window.__nexoraLagDebug = function () {
    var avgMs = frameDeltas.length
      ? (frameDeltas.reduce(function (a, b) { return a + b; }, 0) / frameDeltas.length).toFixed(2)
      : 'n/a';
    console.log(
      '[LagDetector] score:', score, '/ threshold:', SCORE_THRESHOLD,
      '\n  LCP pts:', lcpScoreAdded,
      '| FCP pts:', fcpScoreAdded,
      '| INP pts:', inpScoreAdded, '(worst:', worstInp.toFixed(0) + 'ms)',
      '| TTFB pts:', ttfbScoreAdded,
      '| TBT pts:', tbtScoreAdded, '(accum:', typeof tbtAccum !== 'undefined' ? tbtAccum.toFixed(0) + 'ms' : 'n/a)',
      '| rAF pts:', rafScoreAdded, '(avg frame:', avgMs + 'ms)',
      '\n  dismissed:', localStorage.getItem(DISMISSED_KEY),
      '| preset:', localStorage.getItem(PRESET_KEY),
      '| shown:', shown
    );
  };

  setTimeout(function () {
    if (!shown) {
      console.log('[LagDetector] rAF monitor started (WARMUP_MS:', WARMUP_MS, ')');
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
