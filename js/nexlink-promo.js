/*
  Nexlink Promo
  Pushes users to save bit.ly/nexlinkfinder as the durable entry point
  to Nexora. Implements four ideas:
    1. Persistent dismissible top banner
    3. Exit-intent popup
    6. Ctrl+D / Cmd+D bookmark prompt
    7. "Share with a friend" card (text + downloadable image)
*/
(function () {
  'use strict';

  var BITLY_PLAIN = 'bit.ly/nexlinkfinder';
  var BITLY_URL = 'https://bit.ly/nexlinkfinder';

  var LS = {
    bannerDismissedDay: 'nlp.bannerDismissedDay',  // YYYY-MM-DD of last dismissal
    exitIntentDay: 'nlp.exitIntentDay',            // YYYY-MM-DD of current count window
    exitIntentCount: 'nlp.exitIntentCount',        // number of times shown today
    bookmarkConfirmed: 'nlp.bookmarkConfirmed',
    bookmarkPromptShownAt: 'nlp.bookmarkPromptShownAt'
  };

  var EXIT_MAX_PER_DAY = 2;                          // show up to 2x per day
  var EXIT_MIN_DWELL_MS = 20 * 1000;                 // wait 20s before arming
  var EXIT_MIN_GAP_MS = 5 * 60 * 1000;               // min 5 min between two same-day fires

  /* ---------- helpers ---------- */

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function todayKey() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function toast(msg) {
    if (window.NexoraNotify && typeof window.NexoraNotify.show === 'function') {
      window.NexoraNotify.show({ message: msg, type: 'success', duration: 2500 });
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function isMac() {
    return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  }

  /* ---------- modal primitive ---------- */

  function buildModal(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'nlp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (opts.label) overlay.setAttribute('aria-label', opts.label);

    var card = document.createElement('div');
    card.className = 'nlp-card' + (opts.cardClass ? ' ' + opts.cardClass : '');
    overlay.appendChild(card);

    if (opts.build) opts.build(card, function close() { closeModal(overlay); });

    function onKey(e) {
      if (e.key === 'Escape') closeModal(overlay);
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
    document.addEventListener('keydown', onKey);
    overlay._cleanup = function () { document.removeEventListener('keydown', onKey); };

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('nlp-open'); });
    return overlay;
  }

  function closeModal(overlay) {
    if (!overlay || !overlay.parentNode) return;
    overlay.classList.remove('nlp-open');
    overlay.classList.add('nlp-closing');
    setTimeout(function () {
      if (overlay._cleanup) overlay._cleanup();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 220);
  }

  /* ---------- shared markup helpers ---------- */

  function makeUrlBlock(onCopy) {
    var wrap = document.createElement('div');
    wrap.className = 'nlp-url-block';

    var label = document.createElement('div');
    label.className = 'nlp-url-label';
    label.textContent = 'Save this link';
    wrap.appendChild(label);

    var row = document.createElement('div');
    row.className = 'nlp-url-row';

    var url = document.createElement('div');
    url.className = 'nlp-url-text';
    url.textContent = BITLY_PLAIN;
    row.appendChild(url);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nlp-btn nlp-btn-primary nlp-copy-btn';
    btn.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i><span>Copy</span>';
    btn.addEventListener('click', function () {
      copyText(BITLY_PLAIN).then(function (ok) {
        if (ok) {
          btn.classList.add('nlp-copied');
          btn.querySelector('span').textContent = 'Copied';
          setTimeout(function () {
            btn.classList.remove('nlp-copied');
            btn.querySelector('span').textContent = 'Copy';
          }, 1800);
          if (onCopy) onCopy();
        }
      });
    });
    row.appendChild(btn);

    wrap.appendChild(row);
    return wrap;
  }

  /* ---------- 1. Top banner ---------- */

  function shouldShowBanner() {
    if (lsGet(LS.bookmarkConfirmed) === '1') return false;
    // Show at least once per day. If dismissed today, don't show again today.
    if (lsGet(LS.bannerDismissedDay) === todayKey()) return false;
    return true;
  }

  function mountBanner() {
    if (document.getElementById('nlp-banner')) return;
    if (!shouldShowBanner()) return;

    var bar = document.createElement('div');
    bar.id = 'nlp-banner';
    bar.className = 'nlp-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Save the Nexora link finder');

    var inner = document.createElement('div');
    inner.className = 'nlp-banner-inner';

    var icon = document.createElement('div');
    icon.className = 'nlp-banner-icon';
    icon.innerHTML = '<i class="fas fa-bookmark" aria-hidden="true"></i>';
    inner.appendChild(icon);

    var text = document.createElement('div');
    text.className = 'nlp-banner-text';
    text.innerHTML =
      '<strong>Lost Nexora before?</strong> ' +
      '<span class="nlp-banner-sub">Save <span class="nlp-banner-url">' + BITLY_PLAIN +
      '</span>, it will always find the newest working links.</span>';
    inner.appendChild(text);

    var actions = document.createElement('div');
    actions.className = 'nlp-banner-actions';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'nlp-btn nlp-btn-primary';
    copyBtn.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i><span>Copy link</span>';
    copyBtn.addEventListener('click', function () {
      copyText(BITLY_PLAIN).then(function (ok) {
        if (ok) {
          toast('Copied ' + BITLY_PLAIN + ' &mdash; paste it anywhere to save it');
          copyBtn.querySelector('span').textContent = 'Copied';
          setTimeout(function () { copyBtn.querySelector('span').textContent = 'Copy link'; }, 1800);
        }
      });
    });
    actions.appendChild(copyBtn);

    var shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'nlp-btn nlp-btn-ghost';
    shareBtn.innerHTML = '<i class="fas fa-share-nodes" aria-hidden="true"></i><span>Share</span>';
    shareBtn.addEventListener('click', openShareCard);
    actions.appendChild(shareBtn);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nlp-banner-close';
    closeBtn.setAttribute('aria-label', 'Dismiss banner');
    closeBtn.innerHTML = '<i class="fas fa-xmark" aria-hidden="true"></i>';
    closeBtn.addEventListener('click', function () {
      lsSet(LS.bannerDismissedDay, todayKey());
      bar.classList.add('nlp-banner-hide');
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 260);
    });
    actions.appendChild(closeBtn);

    inner.appendChild(actions);
    bar.appendChild(inner);
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add('nlp-banner-show'); });
  }

  /* ---------- 3. Exit intent ---------- */

  var exitArmed = false;
  var exitFiredThisPage = false;
  var loadedAt = Date.now();
  var lastExitFireAt = 0;

  function getExitTodayCount() {
    if (lsGet(LS.exitIntentDay) !== todayKey()) return 0;
    return parseInt(lsGet(LS.exitIntentCount) || '0', 10) || 0;
  }

  function bumpExitTodayCount() {
    var today = todayKey();
    var count = (lsGet(LS.exitIntentDay) === today)
      ? (parseInt(lsGet(LS.exitIntentCount) || '0', 10) || 0)
      : 0;
    lsSet(LS.exitIntentDay, today);
    lsSet(LS.exitIntentCount, String(count + 1));
  }

  function exitIntentAvailable() {
    if (lsGet(LS.bookmarkConfirmed) === '1') return false;
    if (getExitTodayCount() >= EXIT_MAX_PER_DAY) return false;
    if (Date.now() - lastExitFireAt < EXIT_MIN_GAP_MS) return false;
    return true;
  }

  function armExitIntent() {
    if (!exitIntentAvailable()) return;

    setTimeout(function () { exitArmed = true; }, EXIT_MIN_DWELL_MS);

    document.addEventListener('mouseout', function (e) {
      if (!exitArmed || exitFiredThisPage) return;
      if (!exitIntentAvailable()) return;
      if (e.relatedTarget || e.toElement) return;
      // moving up out of the viewport (toward tab bar / address bar)
      if (e.clientY > 8) return;
      fireExitIntent();
    });

    // Mobile / no-mouse fallback: page becomes hidden
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden') return;
      if (exitFiredThisPage) return;
      if (!exitIntentAvailable()) return;
      if (Date.now() - loadedAt < EXIT_MIN_DWELL_MS) return;
      // Defer: only show next time the page becomes visible again
      var onShow = function () {
        if (document.visibilityState === 'visible' && !exitFiredThisPage && exitIntentAvailable()) {
          document.removeEventListener('visibilitychange', onShow);
          fireExitIntent();
        }
      };
      document.addEventListener('visibilitychange', onShow);
    });
  }

  function fireExitIntent() {
    if (exitFiredThisPage) return;
    if (!exitIntentAvailable()) return;
    exitFiredThisPage = true;
    lastExitFireAt = Date.now();
    bumpExitTodayCount();

    buildModal({
      label: 'Save the Nexora link finder before you go',
      cardClass: 'nlp-card-exit',
      build: function (card, close) {
        card.innerHTML =
          '<button type="button" class="nlp-card-close" aria-label="Close">' +
            '<i class="fas fa-xmark" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="nlp-eyebrow">Before you go</div>' +
          '<h2 class="nlp-title">Save the one link that always works.</h2>' +
          '<p class="nlp-body">' +
            'Domains get blocked. Tabs close. ' +
            '<strong>' + BITLY_PLAIN + '</strong> is the permanent doorway' +
            'it always sends you to the latest working Nexora link.' +
          '</p>';

        card.appendChild(makeUrlBlock(function () {
          toast('Now paste it into your bookmarks, notes, or chat');
        }));

        var row = document.createElement('div');
        row.className = 'nlp-actions-row';

        var bookmarkBtn = document.createElement('button');
        bookmarkBtn.type = 'button';
        bookmarkBtn.className = 'nlp-btn nlp-btn-secondary';
        bookmarkBtn.innerHTML = '<i class="fas fa-bookmark" aria-hidden="true"></i><span>How to bookmark</span>';
        bookmarkBtn.addEventListener('click', function () { close(); openBookmarkPrompt(true); });
        row.appendChild(bookmarkBtn);

        var shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'nlp-btn nlp-btn-ghost';
        shareBtn.innerHTML = '<i class="fas fa-share-nodes" aria-hidden="true"></i><span>Send to myself</span>';
        shareBtn.addEventListener('click', function () { close(); openShareCard(); });
        row.appendChild(shareBtn);

        card.appendChild(row);

        card.querySelector('.nlp-card-close').addEventListener('click', close);
      }
    });
  }

  /* ---------- 6. Bookmark prompt (Ctrl+D / Cmd+D) ---------- */

  function bindBookmarkShortcut() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'd' && e.key !== 'D') return;
      var combo = (isMac() ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey;
      if (!combo) return;
      // Once the user has confirmed they saved bit.ly/nexlinkfinder, stop intercepting.
      if (lsGet(LS.bookmarkConfirmed) === '1') return;
      // Otherwise, persistently block the native bookmark dialog and show our prompt.
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      // If the prompt is already open, don't stack another one.
      if (document.querySelector('.nlp-overlay .nlp-card-bookmark')) return;
      openBookmarkPrompt(false);
    }, true);
  }

  function openBookmarkPrompt(skipShortcutTip) {
    lsSet(LS.bookmarkPromptShownAt, String(Date.now()));
    var combo = isMac() ? 'Cmd + D' : 'Ctrl + D';

    buildModal({
      label: 'Bookmark the Nexora link finder',
      cardClass: 'nlp-card-bookmark',
      build: function (card, close) {
        card.innerHTML =
          '<button type="button" class="nlp-card-close" aria-label="Close">' +
            '<i class="fas fa-xmark" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="nlp-eyebrow">Bookmark this instead</div>' +
          '<h2 class="nlp-title">Save the link that survives blocks.</h2>' +
          '<p class="nlp-body">' +
            'When you bookmark this site, you bookmark a domain that can be blocked. ' +
            'Bookmark <strong>' + BITLY_PLAIN + '</strong> instead &mdash; ' +
            'it stays the same forever and always points at the latest working link.' +
          '</p>';

        card.appendChild(makeUrlBlock());

        var steps = document.createElement('ol');
        steps.className = 'nlp-steps';
        var stepLines = [
          'Copy the link above.',
          'Open your browser bookmarks menu (the star icon in the address bar, or the menu &gt; Bookmarks).',
          'Paste <strong>' + BITLY_PLAIN + '</strong> as the URL and save.',
          'Click <strong>I saved it</strong> below so we stop interrupting <strong>' + combo + '</strong>.'
        ];
        for (var i = 0; i < stepLines.length; i++) {
          var li = document.createElement('li');
          li.innerHTML = stepLines[i];
          steps.appendChild(li);
        }
        card.appendChild(steps);

        var row = document.createElement('div');
        row.className = 'nlp-actions-row';

        var doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.className = 'nlp-btn nlp-btn-primary';
        doneBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i><span>I saved it</span>';
        doneBtn.addEventListener('click', function () {
          lsSet(LS.bookmarkConfirmed, '1');
          toast('Nice. ' + BITLY_PLAIN + ' will always bring you back.');
          var b = document.getElementById('nlp-banner');
          if (b && b.parentNode) b.parentNode.removeChild(b);
          close();
        });
        row.appendChild(doneBtn);

        var shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'nlp-btn nlp-btn-ghost';
        shareBtn.innerHTML = '<i class="fas fa-share-nodes" aria-hidden="true"></i><span>Send to myself</span>';
        shareBtn.addEventListener('click', function () { close(); openShareCard(); });
        row.appendChild(shareBtn);

        card.appendChild(row);

        card.querySelector('.nlp-card-close').addEventListener('click', close);
      }
    });
  }

  /* ---------- 7. Share card ---------- */

  /* Read live theme tokens from CSS so the share image matches the user's theme. */
  function readThemeTokens() {
    var s = getComputedStyle(document.documentElement);
    function v(name, fallback) {
      var raw = s.getPropertyValue(name);
      return (raw && raw.trim()) ? raw.trim() : fallback;
    }
    // theme-tokens.css uses --page-bg / --panel / --orange / --orange-deep / --text / --muted
    // _tokens.css uses --primary / --primary-deep. Try both.
    return {
      bg:       v('--page-bg',      '#0a0605'),
      panel:    v('--panel',        v('--surface', '#1a100d')),
      accent:   v('--orange',       v('--primary', '#d4550a')),
      accentDeep: v('--orange-deep', v('--primary-deep', '#992f05')),
      text:     v('--text',         '#f8e7e0'),
      muted:    v('--muted',        '#c9a08a'),
      onAccent: v('--send-icon',    v('--on-primary', '#fff0e8'))
    };
  }

  /* Parse any CSS color string into {r,g,b,a} via the browser. */
  function parseColor(css) {
    var probe = parseColor._probe;
    if (!probe) {
      probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
      parseColor._probe = probe;
    }
    probe.style.color = '';
    probe.style.color = css;
    var rgb = getComputedStyle(probe).color || 'rgb(0,0,0)';
    var m = rgb.match(/rgba?\(([^)]+)\)/);
    if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    var parts = m[1].split(',').map(function (x) { return parseFloat(x); });
    return {
      r: parts[0] | 0,
      g: parts[1] | 0,
      b: parts[2] | 0,
      a: parts.length > 3 ? parts[3] : 1
    };
  }

  function rgba(c, a) {
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function isLightColor(c) {
    // Perceived luminance
    var l = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return l > 0.6;
  }

  function buildShareImage() {
    var W = 1200, H = 630;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var t = readThemeTokens();
    var bg       = parseColor(t.bg);
    var panel    = parseColor(t.panel);
    var accent   = parseColor(t.accent);
    var accentDeep = parseColor(t.accentDeep);
    var text     = parseColor(t.text);
    var muted    = parseColor(t.muted);
    var onAccent = parseColor(t.onAccent);
    var lightBg  = isLightColor(bg);

    // Background gradient (page-bg -> panel)
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, rgba(bg, 1));
    grad.addColorStop(1, rgba(panel, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Glow accent
    var glow = ctx.createRadialGradient(W * 0.78, H * 0.2, 20, W * 0.78, H * 0.2, 520);
    glow.addColorStop(0, rgba(accent, lightBg ? 0.28 : 0.45));
    glow.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Secondary glow on the left for depth
    var glow2 = ctx.createRadialGradient(W * 0.05, H * 0.95, 10, W * 0.05, H * 0.95, 460);
    glow2.addColorStop(0, rgba(accentDeep, lightBg ? 0.18 : 0.32));
    glow2.addColorStop(1, rgba(accentDeep, 0));
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = rgba(accent, lightBg ? 0.4 : 0.55);
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    ctx.textBaseline = 'top';

    // Eyebrow
    ctx.fillStyle = rgba(accent, 1);
    ctx.font = '600 28px Poppins, system-ui, sans-serif';
    ctx.fillText('NEXORA', 80, 90);

    // Title
    ctx.fillStyle = rgba(text, 1);
    ctx.font = '700 64px Poppins, system-ui, sans-serif';
    ctx.fillText('Always finds the link.', 80, 150);

    // Big URL — pick the most readable of text vs onAccent
    var urlColor = isLightColor(bg) ? text : (isLightColor(onAccent) ? onAccent : text);
    ctx.fillStyle = rgba(urlColor, 1);
    ctx.font = '800 110px Poppins, system-ui, sans-serif';
    ctx.fillText(BITLY_PLAIN, 80, 260);

    // Subtitle
    ctx.fillStyle = rgba(muted, 1);
    ctx.font = '400 28px Poppins, system-ui, sans-serif';
    ctx.fillText('Save this link. When the site gets blocked, this still works.', 80, 420);

    ctx.fillStyle = rgba(accent, 0.9);
    ctx.font = '600 24px Poppins, system-ui, sans-serif';
    ctx.fillText('Open it. Bookmark it. You are home.', 80, 470);

    return canvas;
  }

  function openShareCard() {
    var shareText =
      'Save this link so you never lose Nexora:\n' +
      BITLY_URL + '\n\n' +
      'When the main site gets blocked, this always points at the latest working link.';

    buildModal({
      label: 'Share or save the Nexora link finder',
      cardClass: 'nlp-card-share',
      build: function (card, close) {
        card.innerHTML =
          '<button type="button" class="nlp-card-close" aria-label="Close">' +
            '<i class="fas fa-xmark" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="nlp-eyebrow">Send to a friend (or yourself)</div>' +
          '<h2 class="nlp-title">One link. Always works.</h2>' +
          '<p class="nlp-body">' +
            'Drop this in your notes, your group chat, or your own DMs. ' +
            'Future-you will thank present-you.' +
          '</p>';

        var preview = document.createElement('div');
        preview.className = 'nlp-share-preview';
        var canvas = buildShareImage();
        canvas.className = 'nlp-share-canvas';
        preview.appendChild(canvas);
        card.appendChild(preview);

        var msgWrap = document.createElement('div');
        msgWrap.className = 'nlp-share-msg-wrap';
        var msgLabel = document.createElement('div');
        msgLabel.className = 'nlp-url-label';
        msgLabel.textContent = 'Copy & paste message';
        msgWrap.appendChild(msgLabel);
        var ta = document.createElement('textarea');
        ta.className = 'nlp-share-textarea';
        ta.rows = 4;
        ta.value = shareText;
        ta.readOnly = true;
        msgWrap.appendChild(ta);
        card.appendChild(msgWrap);

        var row = document.createElement('div');
        row.className = 'nlp-actions-row';

        var copyMsgBtn = document.createElement('button');
        copyMsgBtn.type = 'button';
        copyMsgBtn.className = 'nlp-btn nlp-btn-primary';
        copyMsgBtn.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i><span>Copy message</span>';
        copyMsgBtn.addEventListener('click', function () {
          copyText(shareText).then(function (ok) {
            if (ok) {
              copyMsgBtn.querySelector('span').textContent = 'Copied';
              setTimeout(function () { copyMsgBtn.querySelector('span').textContent = 'Copy message'; }, 1800);
              toast('Message copied. Paste it anywhere.');
            }
          });
        });
        row.appendChild(copyMsgBtn);

        var dlBtn = document.createElement('button');
        dlBtn.type = 'button';
        dlBtn.className = 'nlp-btn nlp-btn-secondary';
        dlBtn.innerHTML = '<i class="fas fa-download" aria-hidden="true"></i><span>Download image</span>';
        dlBtn.addEventListener('click', function () {
          try {
            canvas.toBlob(function (blob) {
              if (!blob) return;
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url;
              a.download = 'nexora-linkfinder.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            }, 'image/png');
          } catch (e) {}
        });
        row.appendChild(dlBtn);

        if (navigator.share) {
          var nativeBtn = document.createElement('button');
          nativeBtn.type = 'button';
          nativeBtn.className = 'nlp-btn nlp-btn-ghost';
          nativeBtn.innerHTML = '<i class="fas fa-share-nodes" aria-hidden="true"></i><span>Share&hellip;</span>';
          nativeBtn.addEventListener('click', function () {
            navigator.share({
              title: 'Nexora Link Finder',
              text: shareText,
              url: BITLY_URL
            }).catch(function () {});
          });
          row.appendChild(nativeBtn);
        }

        card.appendChild(row);

        card.querySelector('.nlp-card-close').addEventListener('click', close);
      }
    });
  }

  /* ---------- public API ---------- */

  window.NexlinkPromo = {
    showBanner: mountBanner,
    openBookmarkPrompt: function () { openBookmarkPrompt(true); },
    openShareCard: openShareCard,
    fireExitIntent: fireExitIntent,
    reset: function () {
      lsDel(LS.bannerDismissedDay);
      lsDel(LS.exitIntentDay);
      lsDel(LS.exitIntentCount);
      lsDel(LS.bookmarkConfirmed);
      lsDel(LS.bookmarkPromptShownAt);
    }
  };

  /* ---------- boot ---------- */

  function boot() {
    mountBanner();
    armExitIntent();
    bindBookmarkShortcut();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
