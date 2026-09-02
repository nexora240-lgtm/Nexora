(function () {
  'use strict';

  const apiBase = (typeof _CONFIG !== 'undefined' && _CONFIG.linkFinderApiUrl) || '';
  const storageKey = 'nexora-link-chat-session';
  const maxHistory = 24;
  const log = document.getElementById('lf-chat-log');
  const form = document.getElementById('lf-chat-form');
  const input = document.getElementById('lf-chat-input');
  const send = document.getElementById('lf-chat-send');
  const meta = document.getElementById('lf-chat-meta');
  let session = loadSession();
  let pending = false;
  let cooldownUntil = 0;
  let cooldownTimer = 0;

  function getContext() {
    return session.context && typeof session.context === 'object' ? session.context : {};
  }

  function rememberBlockedHosts(message) {
    const matches = String(message).match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}/gi) || [];
    const context = getContext();
    const blockedHosts = new Set(Array.isArray(context.blockedHosts) ? context.blockedHosts : []);
    matches.forEach((value) => {
      try { blockedHosts.add(new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase()); } catch {}
    });
    session.context = { ...context, blockedHosts: [...blockedHosts].slice(-100) };
  }

  function loadSession() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  }

  function saveSession() {
    try { localStorage.setItem(storageKey, JSON.stringify(session)); } catch {}
  }

  function addMessage(role, text, links, reportId) {
    const item = document.createElement('article');
    item.className = `lf-chat-message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'lf-chat-bubble';
    const paragraph = document.createElement('p');
    paragraph.textContent = text || '';
    bubble.appendChild(paragraph);
    if (Array.isArray(links) && role === 'bot') appendLinks(bubble, links, reportId);
    item.append(bubble);
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function appendLinks(bubble, links, reportId) {
    const linkWrap = document.createElement('div');
    linkWrap.className = 'lf-chat-links';
    let firstHost = '';
    links.slice(0, 3).forEach((link) => {
      if (!link || typeof link.url !== 'string') return;
      let parsed;
      try { parsed = new URL(link.url); } catch { return; }
      if (!['https:', 'http:'].includes(parsed.protocol)) return;
      const anchor = document.createElement('a');
      anchor.className = 'lf-chat-link';
      anchor.href = parsed.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      const icon = document.createElement('i');
      icon.className = 'fas fa-arrow-up-right-from-square';
      anchor.appendChild(icon);
      const label = document.createElement('span');
      const rawName = link.name || parsed.hostname.split('.')[0];
      label.textContent = rawName.split(/[.\s]/)[0];
      anchor.appendChild(label);
      linkWrap.appendChild(anchor);
      if (!firstHost) firstHost = parsed.hostname.toLowerCase();
    });
    if (!linkWrap.children.length) return;
    bubble.appendChild(linkWrap);
    const report = document.createElement('div');
    report.className = 'lf-chat-report';
    report.dataset.host = firstHost;
    [['worked', 'It worked', 'fa-check'], ['failed', 'Didnt work', 'fa-xmark']].forEach(([value, label, icon]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.verdict = value;
      button.dataset.reportId = reportId || '';
      button.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
      button.addEventListener('click', () => reportResult(value, reportId, report));
      report.appendChild(button);
    });
    bubble.appendChild(report);
  }

  function setMeta(text) { if (meta) meta.textContent = text; }

  function showTyping() {
    const item = document.createElement('article');
    item.className = 'lf-chat-message bot';
    item.id = 'lf-chat-typing';
    item.innerHTML = '<div class="lf-chat-bubble"><span class="lf-chat-typing"><i class="fas fa-circle"></i><i class="fas fa-circle"></i><i class="fas fa-circle"></i></span></div>';
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function removeTyping() { document.getElementById('lf-chat-typing')?.remove(); }

  function applyCooldown(until) {
    const requested = Number(until) || 0;
    cooldownUntil = Math.min(requested, Date.now() + 24 * 60 * 60 * 1000);
    const active = cooldownUntil > Date.now();
    input.disabled = active;
    send.disabled = active;
    window.clearInterval(cooldownTimer);
    if (active) cooldownTimer = window.setInterval(() => applyCooldown(cooldownUntil), 30000);
    if (active) setMeta(`on cooldown, ${Math.ceil((cooldownUntil - Date.now()) / 60000)} min left`);
    else if (cooldownUntil) setMeta('cooldown done, lmk whats blocked or if a link worked');
    return active;
  }

  async function sendMessage(message, extra) {
    if (!apiBase || pending || applyCooldown(cooldownUntil)) return false;
    pending = true;
    send.disabled = true;
    input.value = '';
    addMessage('user', message);
    session.history = Array.isArray(session.history) ? session.history : [];
    session.history.push({ role: 'user', content: message });
    session.history = session.history.slice(-maxHistory);
    rememberBlockedHosts(message);
    saveSession();
    showTyping();
    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: session.history,
          sessionId: session.id || null,
          context: session.context || {},
          event: extra?.event || 'message',
          reportId: extra?.reportId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      session.id = data.sessionId || session.id;
      session.context = { ...getContext(), ...(data.context && typeof data.context === 'object' ? data.context : {}) };
      if (data.cooldownUntil) applyCooldown(data.cooldownUntil);
      const reply = data.reply || data.message || data.text || 'idk what happened, lmk whats blocked and ill try again.';
      addMessage('bot', reply, data.links, data.reportId);
      session.history.push({ role: 'assistant', content: reply });
      session.history = session.history.slice(-maxHistory);
      saveSession();
      if (!cooldownUntil) setMeta('lmk whats blocked or if the link worked');
      return true;
    } catch (error) {
      addMessage('bot', 'link service is down rn, try again in a sec.');
      setMeta('link service unreachable rn');
      return false;
    } finally {
      removeTyping();
      pending = false;
      if (!applyCooldown(cooldownUntil)) send.disabled = false;
      input.focus();
    }
  }

  async function reportResult(verdict, reportId, report) {
    if (report.dataset.sent === 'true') return;
    report.dataset.sent = 'true';
    const buttons = Array.from(report.querySelectorAll('button'));
    buttons.forEach((button) => (button.disabled = true));
    const sent = await sendMessage(verdict === 'worked' ? 'The link worked.' : 'The link did not work.', { event: `link_${verdict}`, reportId, host: report.dataset.host });
    if (!sent) {
      report.dataset.sent = 'false';
      buttons.forEach((button) => (button.disabled = false));
      return false;
    }
    if (verdict === 'worked' && !cooldownUntil) applyCooldown(Date.now() + 24 * 60 * 60 * 1000);
    return true;
  }

  function start() {
    if (!log || !form || !input || !send) return;
    const firstVisit = !Array.isArray(session.history) || session.history.length === 0;
    if (firstVisit) {
      addMessage('bot', 'yo, i can find u one approved link that gets past ur school filter. lmk what filter u got (goguardian, lightspeed, securly, etc) and how strict, 1-5.');
      session.history = [{ role: 'assistant', content: 'yo, i can find u one approved link that gets past ur school filter. lmk what filter u got and how strict, 1-5.' }];
      saveSession();
    } else {
      session.history.filter(item => item && item.role && item.content).slice(-maxHistory).forEach(item => addMessage(item.role === 'assistant' ? 'bot' : 'user', item.content));
    }
    form.addEventListener('submit', event => { event.preventDefault(); const message = input.value.trim(); if (message) sendMessage(message); });
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
    setMeta('one link at a time. tell me if it worked so i can learn.');
  }

  start();
})();
