/**
 * Nexora Link Finder — Simple Search (No AI / No Chat)
 * Users pick strictness + blockers, get up to 3 links per day.
 */
(function () {
  'use strict';

  const API_URL = (typeof _CONFIG !== 'undefined' && _CONFIG.linkFinderApiUrl)
    ? _CONFIG.linkFinderApiUrl
    : '';

  const DAILY_LIMIT = 3;
  const STORAGE_KEY = 'lf-daily';
  const SHOWN_KEY = 'lf-shown-domains';

  // ─── Shown-domains tracking (prevents repeats) ────────────

  function getShownDomains() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SHOWN_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }

  function addShownDomains(domains) {
    const existing = new Set(getShownDomains());
    domains.forEach(d => existing.add(d));
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...existing]));
  }

  // ─── Daily usage tracking ─────────────────────────────────

  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getUsage() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (raw.date !== getTodayKey()) return { date: getTodayKey(), count: 0 };
      return raw;
    } catch { return { date: getTodayKey(), count: 0 }; }
  }

  function saveUsage(usage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  }

  // ─── State ─────────────────────────────────────────────────

  let userContext = { blockers: [] };
  let isSearching = false;
  let currentBlockers = []; // remembered for Next calls

  // ─── DOM refs ──────────────────────────────────────────────

  const selector   = document.getElementById('lf-selector');
  const results    = document.getElementById('lf-results');
  const limitView  = document.getElementById('lf-limit');
  const goBtn      = document.getElementById('lf-go-btn');
  const chipWrap   = document.getElementById('lf-blocker-chips');
  const usageEl    = document.getElementById('lf-results-usage');
  const backBtn    = document.getElementById('lf-back-btn');
  const resetEl    = document.getElementById('lf-limit-reset');
  const singleMid  = document.getElementById('lf-single-mid');
  const titleEl    = document.getElementById('lf-single-title');
  const badgeEl    = document.getElementById('lf-single-badge');
  const counterEl  = document.getElementById('lf-counter');
  const bigLink    = document.getElementById('lf-big-link');
  const nextBtn    = document.getElementById('lf-next-btn');
  const navBar     = document.getElementById('lf-single-nav');

  // ─── Render a single link object ──────────────────────────

  function renderLink(link) {
    titleEl.textContent = link.name || 'Link';
    badgeEl.textContent = link.hostingType || 'link';
    bigLink.href = link.url;
    // Replay fade animation so each link feels fresh
    bigLink.style.animation = 'none';
    void bigLink.offsetWidth;
    bigLink.style.animation = '';
  }

  // ─── Init: check daily limit on load ──────────────────────

  function checkLimit() {
    const usage = getUsage();
    if (usage.count >= DAILY_LIMIT) {
      showLimitScreen();
      return true;
    }
    return false;
  }

  // ─── Reset shown domains on new session ───────────────────
  // Clear when daily usage resets (new day)
  (function cleanStaleShown() {
    try {
      const usage = getUsage();
      if (usage.count === 0) sessionStorage.removeItem(SHOWN_KEY);
    } catch {}
  })();

  // ─── Blocker chips ────────────────────────────────────────

  chipWrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.lf-chip');
    if (!chip) return;
    chip.classList.toggle('active');
    const blocker = chip.dataset.blocker;
    if (chip.classList.contains('active')) {
      if (!userContext.blockers.includes(blocker)) userContext.blockers.push(blocker);
    } else {
      userContext.blockers = userContext.blockers.filter(b => b !== blocker);
    }
    goBtn.disabled = userContext.blockers.length === 0;
  });

  // ─── Find Links button ────────────────────────────────────

  goBtn.addEventListener('click', async () => {
    if (!userContext.blockers.length || isSearching) return;
    if (checkLimit()) return;

    isSearching = true;
    goBtn.disabled = true;
    goBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';

    try {
      currentBlockers = [...userContext.blockers];
      // Clear shown domains so a fresh "Find Links" always works
      sessionStorage.removeItem(SHOWN_KEY);
      const link = await searchOneLink(currentBlockers);

      const usage = getUsage();
      usage.count++;
      saveUsage(usage);

      showResult(link, usage.count);
    } catch (err) {
      console.error('Link Finder error:', err);
      showResult(null, getUsage().count, true);
    }

    isSearching = false;
    goBtn.disabled = false;
    goBtn.innerHTML = '<i class="fas fa-search"></i> Find Links';
  });

  // ─── Back button ──────────────────────────────────────────

  backBtn.addEventListener('click', () => {
    if (checkLimit()) return;
    results.classList.remove('visible');
    selector.classList.remove('hidden');
  });

  // ─── Next button — costs 1 search point ───────────────────

  nextBtn.addEventListener('click', async () => {
    if (isSearching) return;
    if (checkLimit()) return;

    isSearching = true;
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding...';

    try {
      const link = await searchOneLink(currentBlockers);

      const usage = getUsage();
      usage.count++;
      saveUsage(usage);

      // Update usage text and show/hide next based on remaining
      const remaining = DAILY_LIMIT - usage.count;
      usageEl.textContent = remaining > 0
        ? `${remaining} search${remaining !== 1 ? 'es' : ''} remaining today`
        : 'No searches remaining today';
      counterEl.textContent = '';
      backBtn.style.display = remaining > 0 ? '' : 'none';
      navBar.style.display = remaining > 0 ? 'flex' : 'none';

      if (!link) {
        showError('No more new links found. Try a different blocker.');
      } else {
        hideError();
        bigLink.style.display = '';
        renderLink(link);
      }
    } catch (err) {
      console.error('Next link error:', err);
      showError('Something went wrong. Please try again.');
    }

    isSearching = false;
    nextBtn.disabled = false;
    nextBtn.innerHTML = '<i class="fas fa-forward"></i> Try Another Link';
  });

  // ─── API call — fetch exactly one link ───────────────────

  async function searchOneLink(blockers) {
    if (!API_URL) throw new Error('API not configured');

    const currentHostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
    const shownDomains = getShownDomains();
    const excludeDomains = [...new Set([currentHostname, ...shownDomains].filter(Boolean))];

    const resp = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockers, excludeDomains }),
    });

    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json();
    const links = data.links || [];

    // Pick the first link not already shown
    const seen = new Set(shownDomains.map(d => d.toLowerCase()));
    seen.add(currentHostname);

    for (const l of links) {
      if (!l || !l.url) continue;
      let host;
      try { host = new URL(l.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { continue; }
      if (seen.has(host)) continue;
      // Mark as shown immediately
      addShownDomains([host]);
      return l;
    }

    return null; // nothing new
  }

  // ─── Show initial result ───────────────────────────────────

  function showResult(link, usedCount, error) {
    selector.classList.add('hidden');
    limitView.classList.remove('visible');
    results.classList.add('visible');

    const remaining = DAILY_LIMIT - usedCount;
    usageEl.textContent = remaining > 0
      ? `${remaining} search${remaining !== 1 ? 'es' : ''} remaining today`
      : 'No searches remaining today';
    backBtn.style.display = remaining > 0 ? '' : 'none';
    counterEl.textContent = '';

    if (error || !link) {
      bigLink.style.display = 'none';
      navBar.style.display = 'none';
      showError(error
        ? 'Something went wrong. Please try again later.'
        : 'No links found for your blocker. Try selecting a different one.');
      return;
    }

    hideError();
    bigLink.style.display = '';
    navBar.style.display = remaining > 0 ? 'flex' : 'none';
    renderLink(link);
  }

  function showError(msg) {
    let errEl = singleMid.querySelector('.lf-empty');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'lf-empty';
      singleMid.insertBefore(errEl, bigLink);
    }
    errEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i>${msg}`;
    errEl.style.display = '';
  }

  function hideError() {
    const errEl = singleMid.querySelector('.lf-empty');
    if (errEl) errEl.style.display = 'none';
  }

  // ─── Limit screen ─────────────────────────────────────────

  function showLimitScreen() {
    selector.classList.add('hidden');
    results.classList.remove('visible');
    limitView.classList.add('visible');

    // Calculate time until midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msLeft = tomorrow - now;
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    resetEl.textContent = `Resets in ${h}h ${m}m`;
  }

  // ─── Escape HTML ──────────────────────────────────────────

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ─── Init ─────────────────────────────────────────────────

  checkLimit();

  window.NexoraLinkFinder = { version: '2.0.0' };

})();
