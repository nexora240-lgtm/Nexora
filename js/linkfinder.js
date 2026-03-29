/**
 * Nexora Link Finder — Frontend Chat Logic
 * Handles onboarding, chat state, and API communication.
 */
(function () {
  'use strict';

  // Allow re-initialization on SPA re-navigation (DOM is fresh each time)

  const API_URL = (typeof _CONFIG !== 'undefined' && _CONFIG.linkFinderApiUrl)
    ? _CONFIG.linkFinderApiUrl
    : '';

  // ─── State ─────────────────────────────────────────────────

  let conversationHistory = []; // { role: 'user'|'assistant', content: string }
  let userContext = { strictness: null, blockers: [] };
  let isWaiting = false;
  let cooldownUntil = 0;
  let pendingLinks = []; // Queue of validated links to drip-feed one at a time

  // Session ID for rate limiting
  const SESSION_ID = sessionStorage.getItem('lf-session') || (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('lf-session', id);
    return id;
  })();

  // Check for existing cooldown on load
  const savedCooldown = parseInt(localStorage.getItem('lf-cooldown') || '0', 10);
  if (savedCooldown > Date.now()) {
    cooldownUntil = savedCooldown;
  }

  // ─── DOM refs ──────────────────────────────────────────────

  const intro      = document.getElementById('lf-intro');
  const scroll     = document.getElementById('lf-scroll');
  const input      = document.getElementById('lf-prompt');
  const sendBtn    = document.getElementById('lf-send');
  const goBtn      = document.getElementById('lf-go-btn');
  const picker     = document.getElementById('lf-strictness-picker');
  const chipWrap   = document.getElementById('lf-blocker-chips');

  // ─── Onboarding: Strictness picker ────────────────────────

  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('.lf-strict-btn');
    if (!btn) return;

    picker.querySelectorAll('.lf-strict-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    userContext.strictness = parseInt(btn.dataset.level, 10);
    goBtn.disabled = false;
  });

  // ─── Onboarding: Blocker chips ────────────────────────────

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
  });

  // ─── Onboarding: Go button ────────────────────────────────

  goBtn.addEventListener('click', () => {
    if (!userContext.strictness) return;

    // Build initial message from selections
    let msg = `My school's strictness level is ${userContext.strictness}/10.`;
    if (userContext.blockers.length > 0) {
      msg += ` They use ${userContext.blockers.join(', ')}.`;
    }
    msg += ' What links work for me?';

    // Hide intro, show chat, reset link queue for fresh search
    intro.classList.add('hidden');
    pendingLinks = [];
    sendMessage(msg);
  });

  // ─── Chat: Send ───────────────────────────────────────────

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  function handleSend() {
    if (cooldownUntil > Date.now()) {
      showCooldownBanner();
      return;
    }
    const text = input.value.trim();
    if (!text || isWaiting) return;
    input.value = '';

    // If intro is still showing, hide it
    if (!intro.classList.contains('hidden')) {
      intro.classList.add('hidden');
    }

    // Check if user is asking for the next link and we have queued links
    if (pendingLinks.length > 0 && isNextLinkRequest(text)) {
      serveNextLink(text);
      return;
    }

    sendMessage(text);
  }

  /** Detect if the user is asking for another/next link */
  function isNextLinkRequest(text) {
    const t = text.toLowerCase();
    const phrases = [
      'didn\'t work', 'didnt work', 'doesn\'t work', 'doesnt work',
      'not work', 'blocked', 'another', 'next', 'try again',
      'give me another', 'next one', 'another one', 'new link',
      'different link', 'different one', 'still blocked', 'nope',
      'no luck', 'failed', 'got blocked',
    ];
    return phrases.some(p => t.includes(p));
  }

  /** Serve the next queued link without an API call */
  function serveNextLink(userText) {
    appendMessage('user', userText);
    conversationHistory.push({ role: 'user', content: userText });

    const nextLink = pendingLinks.shift();
    const remaining = pendingLinks.length;
    let reply = 'Here\'s another link to try:';
    if (remaining > 0) {
      reply += ` I still have **${remaining}** more if this one doesn't work.`;
    } else {
      reply += ' This is the last one I have for your setup.';
    }

    appendMessage('bot', reply, [nextLink]);
    conversationHistory.push({ role: 'assistant', content: reply });
    input.value = '';
    input.focus();
  }

  async function sendMessage(text) {
    isWaiting = true;
    sendBtn.disabled = true;

    // Add user message to UI
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });

    // Show typing indicator
    const typing = showTyping();

    try {
      const result = await callAPI(text);

      // Remove typing
      typing.remove();

      // ── Client-side validation: strictly enforce blocker list ──
      const validated = validateLinks(result.links, result.reply);

      // Add bot response (using validated data)
      appendMessage('bot', validated.reply, validated.links);
      conversationHistory.push({ role: 'assistant', content: validated.reply });

      // Handle cooldown from server
      if (result.cooldown) {
        cooldownUntil = result.cooldown.until || (Date.now() + (result.cooldown.hours || 1) * 3600000);
        localStorage.setItem('lf-cooldown', String(cooldownUntil));
        showCooldownBanner();
      }
      // Handle rate limit
      if (result.retryAfter) {
        cooldownUntil = Date.now() + result.retryAfter * 1000;
        localStorage.setItem('lf-cooldown', String(cooldownUntil));
        showCooldownBanner();
      }

    } catch (err) {
      typing.remove();
      appendMessage('bot', "Sorry, I couldn't reach the server. Please try again in a moment.");
      console.error('Link Finder API error:', err);
    }

    isWaiting = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // ─── API Call ─────────────────────────────────────────────

  /**
   * Validate links returned by the API against the user's actual blocker list.
   * Strips out false bypass claims and replaces the reply if the AI lied.
   */
  function validateLinks(links, reply) {
    if (!links || links.length === 0) return { links: [], reply };

    const selectedBlockers = userContext.blockers.map(b => b.toLowerCase().trim());

    // If user didn't select any blockers, pass through (no claims to verify)
    if (selectedBlockers.length === 0) return { links, reply };

    // For each link, filter its bypasses to only include things actually in its data
    // AND only show bypass claims for things the user asked about
    const validatedLinks = [];

    for (const link of links) {
      const linkBypasses = (link.bypasses || []).map(b => b.toLowerCase().trim());

      // Check: does this link's bypass data include ANY of the user's blockers?
      const matchedBlockers = selectedBlockers.filter(b => linkBypasses.includes(b));

      if (matchedBlockers.length > 0) {
        // Link truly bypasses at least one of the user's blockers — keep it,
        // but only show the bypasses that match the user's selected blockers
        validatedLinks.push({
          ...link,
          bypasses: matchedBlockers.map(b => b.charAt(0).toUpperCase() + b.slice(1)),
        });
      }
      // If no match, drop the link entirely — it was a false recommendation
    }

    // If all links were filtered out, the AI lied — replace the reply
    if (validatedLinks.length === 0 && links.length > 0) {
      const blockerNames = userContext.blockers.join(', ');
      pendingLinks = [];
      return {
        links: [],
        reply: `I don't currently have any verified links that bypass **${blockerNames}**. I won't recommend links unless they're confirmed to work with your specific blocker. If you'd like, you can ask again later — new links are added regularly.`,
      };
    }

    // Drip-feed: show only the first link, queue the rest
    const firstLink = validatedLinks[0];
    pendingLinks = validatedLinks.slice(1);

    const remaining = pendingLinks.length;
    let adjustedReply = reply;
    if (remaining > 0) {
      adjustedReply += `\n\nIf this link doesn't work, just let me know and I'll give you another one. I have **${remaining}** more to try.`;
    }

    return { links: [firstLink], reply: adjustedReply };
  }

  async function callAPI(message) {
    if (!API_URL) {
      return {
        reply: "**Link Finder is not configured yet.** The admin needs to set `linkFinderApiUrl` in config.js after deploying the AWS backend.\n\nSee `aws/deploy.ps1` in the project for deployment instructions.",
        links: [],
        source: 'error',
      };
    }

    const resp = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory.slice(-20),
        userContext,
        sessionId: SESSION_ID,
        instructions: 'STRICT RULES: 1) Only recommend links whose blockers array explicitly includes the user\'s selected blockers. Never claim a link bypasses a blocker unless that blocker is in the link\'s verified data. If no links match, say so honestly instead of guessing. 2) Only return ONE link at a time. If the user says it does not work, return the next single link. Never return multiple links in one response.',
      }),
    });

    if (!resp.ok && resp.status !== 429) {
      throw new Error(`API returned ${resp.status}`);
    }

    return await resp.json();
  }

  // ─── UI: Append message ───────────────────────────────────

  function appendMessage(role, text, links) {
    const div = document.createElement('div');
    div.className = `lf-msg ${role}`;

    if (role === 'bot') {
      div.innerHTML = renderMarkdown(text);

      // Render link cards if present
      if (links && links.length > 0) {
        const cards = document.createElement('div');
        cards.className = 'lf-link-cards';
        links.forEach(l => {
          const a = document.createElement('a');
          a.className = 'lf-link-card';
          a.href = l.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          const bypassHtml = (l.bypasses && l.bypasses.length > 0)
            ? `<div class="lf-card-bypass">\u2705 Gets past ${esc(l.bypasses.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', '))}</div>`
            : '';
          a.innerHTML = `
            <div class="lf-card-icon"><i class="fas fa-globe"></i></div>
            <div class="lf-card-info">
              <div class="lf-card-name">${esc(l.name)}</div>
              <div class="lf-card-url">${esc(l.url)}</div>
              ${bypassHtml}
            </div>
            <div class="lf-card-badge">${esc(l.hostingType || 'link')}</div>
          `;
          cards.appendChild(a);
        });
        div.appendChild(cards);
      }
    } else {
      div.textContent = text;
    }

    scroll.appendChild(div);
    scroll.scrollTop = scroll.scrollHeight;
  }

  // ─── UI: Typing indicator ────────────────────────────────

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'lf-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    scroll.appendChild(div);
    scroll.scrollTop = scroll.scrollHeight;
    return div;
  }

  // ─── Markdown-lite renderer ──────────────────────────────

  function renderMarkdown(text) {
    let html = esc(text);
    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ─── Cooldown UI ───────────────────────────────────────────

  function showCooldownBanner() {
    let banner = document.querySelector('.lf-cooldown-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'lf-cooldown-banner';
      const footer = document.querySelector('.lf-footer');
      if (footer) footer.parentNode.insertBefore(banner, footer);
    }
    input.disabled = true;
    sendBtn.disabled = true;

    function tick() {
      const left = cooldownUntil - Date.now();
      if (left <= 0) {
        banner.remove();
        input.disabled = false;
        sendBtn.disabled = false;
        cooldownUntil = 0;
        localStorage.removeItem('lf-cooldown');
        return;
      }
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      banner.textContent = h > 0
        ? `\u23F3 You can chat again in ${h}h ${m}m`
        : `\u23F3 You can chat again in ${m} minute${m !== 1 ? 's' : ''}`;
      setTimeout(tick, 30000);
    }
    tick();
  }

  // Activate cooldown banner if loaded with an active cooldown
  if (cooldownUntil > Date.now()) showCooldownBanner();

  // ─── Expose ──────────────────────────────────────────────

  window.NexoraLinkFinder = { version: '1.0.0' };

})();
