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

  // ─── DOM refs ──────────────────────────────────────────────

  const selector   = document.getElementById('lf-selector');
  const results    = document.getElementById('lf-results');
  const limitView  = document.getElementById('lf-limit');
  const goBtn      = document.getElementById('lf-go-btn');
  const chipWrap   = document.getElementById('lf-blocker-chips');
  const cardsWrap  = document.getElementById('lf-link-cards');
  const usageEl    = document.getElementById('lf-results-usage');
  const backBtn    = document.getElementById('lf-back-btn');
  const resetEl    = document.getElementById('lf-limit-reset');

  // ─── Init: check daily limit on load ──────────────────────

  function checkLimit() {
    const usage = getUsage();
    if (usage.count >= DAILY_LIMIT) {
      showLimitScreen();
      return true;
    }
    return false;
  }

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
      const links = await searchLinks(userContext.blockers);

      // Increment usage
      const usage = getUsage();
      usage.count++;
      saveUsage(usage);

      showResults(links, usage.count);
    } catch (err) {
      console.error('Link Finder error:', err);
      showResults([], getUsage().count, true);
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

  // ─── API call ─────────────────────────────────────────────

  async function searchLinks(blockers) {
    if (!API_URL) throw new Error('API not configured');

    const resp = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockers }),
    });

    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json();
    return data.links || [];
  }

  // ─── Show results ─────────────────────────────────────────

  function showResults(links, usedCount, error) {
    selector.classList.add('hidden');
    limitView.classList.remove('visible');
    results.classList.add('visible');

    const remaining = DAILY_LIMIT - usedCount;
    usageEl.textContent = remaining > 0
      ? `${remaining} search${remaining !== 1 ? 'es' : ''} remaining today`
      : 'No searches remaining today';

    // Hide back button if no searches left
    backBtn.style.display = remaining > 0 ? '' : 'none';

    cardsWrap.innerHTML = '';

    if (error) {
      cardsWrap.innerHTML = '<div class="lf-empty">Something went wrong. Please try again later.</div>';
      return;
    }

    if (links.length === 0) {
      cardsWrap.innerHTML = '<div class="lf-empty">No links found for your blocker. Try selecting a different one.</div>';
      return;
    }

    links.forEach(l => {
      const a = document.createElement('a');
      a.className = 'lf-link-card';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      a.innerHTML = `
        <div class="lf-card-icon"><i class="fas fa-globe"></i></div>
        <div class="lf-card-info">
          <div class="lf-card-name">${esc(l.name)}</div>
          <div class="lf-card-url">${esc(l.url)}</div>
        </div>
        <div class="lf-card-badge">${esc(l.hostingType || 'link')}</div>
      `;
      cardsWrap.appendChild(a);
    });

    // If that was the last search, auto-show limit after a delay
    if (remaining <= 0) {
      setTimeout(() => showLimitScreen(), 0);
    }
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
