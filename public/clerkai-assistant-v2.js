(() => {
  'use strict';
  if (window.__clerkAIAssistantV2Loaded) return;
  window.__clerkAIAssistantV2Loaded = true;

  const FUNCTIONS_BASE = 'https://ipazbzctivqquwndifxh.supabase.co/functions/v1';
  const PROJECT_REF = 'ipazbzctivqquwndifxh';
  const WIDGET_KEY = '21332d02-8c76-458b-9961-267db3044205';
  const state = { sessionId: '', sessionToken: '', bootstrapPromise: null };

  const isAppArea = () => /^\/(app|admin)(?:\/|$)/.test(window.location.pathname);

  function getAccessToken() {
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i) || '';
        if (!key.includes(PROJECT_REF) || !key.endsWith('-auth-token')) continue;
        const value = window.localStorage.getItem(key);
        if (!value) continue;
        const parsed = JSON.parse(value);
        const token = parsed?.access_token || parsed?.currentSession?.access_token;
        if (typeof token === 'string' && token.length > 40) return token;
      }
    } catch {
      return '';
    }
    return '';
  }

  async function bootstrapPublic() {
    if (state.sessionId && state.sessionToken) return;
    if (state.bootstrapPromise) return state.bootstrapPromise;
    state.bootstrapPromise = fetch(`${FUNCTIONS_BASE}/site-chat-bootstrap?key=${encodeURIComponent(WIDGET_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clark-widget': 'public-site' },
      body: '{}',
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.session_id || !data.session_token) throw new Error('bootstrap_failed');
      state.sessionId = data.session_id;
      state.sessionToken = data.session_token;
    }).finally(() => { state.bootstrapPromise = null; });
    return state.bootstrapPromise;
  }

  async function askAuthenticated(message, token) {
    const response = await fetch(`${FUNCTIONS_BASE}/app-assistant-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.answer) throw new Error(data.error || `assistant_${response.status}`);
    return { text: data.answer, links: Array.isArray(data.links) ? data.links : [] };
  }

  async function askPublic(message) {
    await bootstrapPublic();
    const response = await fetch(`${FUNCTIONS_BASE}/site-chat-message?key=${encodeURIComponent(WIDGET_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clark-widget': 'public-site' },
      body: JSON.stringify({ session_id: state.sessionId, session_token: state.sessionToken, message }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      state.sessionId = '';
      state.sessionToken = '';
      await bootstrapPublic();
      return askPublic(message);
    }
    if (!response.ok || !data.answer) throw new Error(data.error || `public_assistant_${response.status}`);
    const links = (data.sources || [])
      .filter((source) => source?.url && /^https:\/\//i.test(source.url))
      .slice(0, 3)
      .map((source) => ({ label: source.name || 'Approfondisci', href: source.url }));
    return { text: data.answer, links };
  }

  function safeFallback() {
    if (isAppArea() && getAccessToken()) {
      return {
        text: 'Non riesco a leggere in questo momento lo stato aggiornato del tuo account. Riprova tra poco: nell’area riservata devo verificare il piano e la configurazione reale prima di dirti che una funzione è disponibile.',
        links: [{ label: 'Vai alla panoramica', href: '/app' }],
      };
    }
    return {
      text: 'ClerkAI gestisce receptionist AI, CRM, agenda Google Calendar dopo collegamento e collaudo, chatbot sito e onboarding assistito. WhatsApp e Meta Lead Ads non sono attivi nella fase attuale. Per informazioni specifiche posso verificare le fonti ufficiali appena il servizio torna disponibile.',
      links: [{ label: 'Come funziona', href: '/presentazione' }, { label: 'Piani', href: '/pricing' }],
    };
  }

  async function getAnswer(message) {
    const token = getAccessToken();
    try {
      if (isAppArea() && token) return await askAuthenticated(message, token);
      return await askPublic(message);
    } catch (error) {
      console.warn('[ClerkAI assistant] request unavailable', error);
      return safeFallback();
    }
  }

  const authenticated = isAppArea() && Boolean(getAccessToken());
  const title = authenticated ? 'Assistente ClerkAI' : 'Assistente ClerkAI';
  const subtitle = authenticated
    ? 'Verifico piano, configurazione e prossimi passaggi del tuo account'
    : 'Informazioni su funzioni, piani, casi d’uso e sicurezza';
  const welcome = authenticated
    ? 'Posso controllare il tuo piano e distinguere cosa è incluso, cosa è già configurato e cosa manca. Chiedimi, ad esempio, come collegare Google Calendar o perché una funzione non è disponibile.'
    : 'Posso spiegarti cosa fa ClerkAI, cosa è disponibile nella fase attuale, i piani e come si applica alla tua attività.';
  const suggestions = authenticated
    ? ['Cosa include il mio piano?', 'Come collego Google Calendar?', 'Cosa devo ancora configurare?', 'Perché una funzione non è disponibile?']
    : ['Come funziona?', 'Quanto costa?', 'Può servire alla mia attività?', 'Quali funzioni sono attive oggi?'];

  const host = document.createElement('div');
  host.id = 'clerkai-assistant-host';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial} *,*::before,*::after{box-sizing:border-box} button,input{font:inherit}
    .launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border:1px solid #dbeafe;border-radius:999px;background:#fff;color:#0f172a;box-shadow:0 14px 38px rgba(15,23,42,.15);cursor:pointer;display:grid;place-items:center}
    .launcher:hover{transform:translateY(-1px);box-shadow:0 18px 44px rgba(15,23,42,.18)}
    .launcher:focus-visible,.close:focus-visible,.send:focus-visible,.chip:focus-visible,.link:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
    .launcher svg{width:24px;height:24px}
    .panel{position:fixed;right:16px;bottom:88px;z-index:2147482999;width:min(420px,calc(100vw - 24px));height:min(650px,calc(100dvh - 108px));display:none;flex-direction:column;overflow:hidden;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 28px 80px rgba(15,23,42,.18);font:14px/1.48 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.panel.open{display:flex}
    .header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px;background:#fff;border-bottom:1px solid #e2e8f0}.eyebrow{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px}.status{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.12)}.title{font-size:16px;font-weight:750;line-height:1.25}.subtitle{font-size:12px;line-height:1.38;color:#64748b;margin-top:4px;max-width:320px}.close{border:0;background:transparent;color:#64748b;cursor:pointer;font-size:24px;line-height:1;padding:0 2px}
    .messages{flex:1 1 auto;min-height:0;overflow:auto;background:#f8fafc;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}.msg{max-width:90%;border-radius:15px;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.5}.assistant{align-self:flex-start;background:#fff;border:1px solid #e2e8f0}.user{align-self:flex-end;background:#eff6ff;border:1px solid #dbeafe}.links{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.link{display:inline-flex;align-items:center;border:1px solid #dbe3ef;border-radius:999px;padding:6px 9px;text-decoration:none;color:#075985;background:#f8fafc;font-size:11.5px;font-weight:650}
    .suggestions{flex:0 0 auto;padding:8px 10px 0;background:#fff;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.suggestions::-webkit-scrollbar{display:none}.chip{flex:0 0 auto;max-width:280px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#334155;padding:7px 10px;cursor:pointer;font-size:12px;white-space:nowrap}.chip:hover{background:#f8fafc}
    .composer{flex:0 0 auto;padding:10px;background:#fff;border-top:1px solid #eef2f7}.form{display:flex;align-items:flex-end;gap:8px}.input{min-width:0;flex:1;border:1px solid #cbd5e1;border-radius:13px;padding:10px 12px;background:#fff;color:#0f172a;outline:none}.input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.12)}.send{border:0;border-radius:12px;background:#0f172a;color:#fff;padding:10px 13px;font-weight:700;cursor:pointer}.send:disabled{opacity:.55;cursor:not-allowed}.note{font-size:10.5px;color:#94a3b8;margin-top:7px;line-height:1.35}
    .typing{display:inline-flex;gap:4px;align-items:center;height:16px}.typing span{width:5px;height:5px;border-radius:50%;background:#94a3b8;animation:blink 1s infinite ease-in-out}.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}
    @media(max-width:520px){.launcher{right:14px;bottom:14px}.panel{right:8px;bottom:80px;width:calc(100vw - 16px);height:min(72dvh,650px);border-radius:18px}}
  `;

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Assistente ClerkAI');

  const header = document.createElement('div');
  header.className = 'header';
  const headerCopy = document.createElement('div');
  const eyebrow = document.createElement('div');
  eyebrow.className = 'eyebrow';
  const dot = document.createElement('span');
  dot.className = 'status';
  eyebrow.append(dot, document.createTextNode(authenticated ? 'Area riservata' : 'Assistente AI'));
  const titleEl = document.createElement('div');
  titleEl.className = 'title';
  titleEl.textContent = title;
  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'subtitle';
  subtitleEl.textContent = subtitle;
  headerCopy.append(eyebrow, titleEl, subtitleEl);
  const close = document.createElement('button');
  close.className = 'close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Chiudi assistente');
  close.textContent = '×';
  header.append(headerCopy, close);

  const messages = document.createElement('div');
  messages.className = 'messages';
  const suggestionsEl = document.createElement('div');
  suggestionsEl.className = 'suggestions';
  suggestions.forEach((text) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = text;
    chip.addEventListener('click', () => submitQuestion(text));
    suggestionsEl.appendChild(chip);
  });

  const composer = document.createElement('div');
  composer.className = 'composer';
  const form = document.createElement('form');
  form.className = 'form';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'text';
  input.maxLength = 1500;
  input.autocomplete = 'off';
  input.placeholder = authenticated ? 'Chiedi del tuo piano o configurazione…' : 'Scrivi la tua domanda…';
  const send = document.createElement('button');
  send.className = 'send';
  send.type = 'submit';
  send.textContent = 'Invia';
  form.append(input, send);
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = authenticated
    ? 'L’assistente usa lo stato reale del tuo account. Non inserire password, documenti o dati sensibili.'
    : 'Risposte basate sulle informazioni ufficiali ClerkAI. Non inserire password, documenti o dati sensibili.';
  composer.append(form, note);
  panel.append(header, messages, suggestionsEl, composer);

  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Apri assistente ClerkAI');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.appendChild(iconBubble());

  root.append(style, panel, launcher);
  addAssistant(welcome, []);

  launcher.addEventListener('click', () => {
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => input.focus(), 0);
  });
  close.addEventListener('click', () => {
    panel.classList.remove('open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitQuestion(input.value);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('open')) {
      panel.classList.remove('open');
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    }
  });

  async function submitQuestion(value) {
    const question = String(value || '').trim();
    if (!question || send.disabled) return;
    input.value = '';
    addMessage('user', question, []);
    send.disabled = true;
    const typing = addTyping();
    try {
      const result = await getAnswer(question);
      typing.remove();
      addAssistant(result.text, result.links || []);
    } catch {
      typing.remove();
      const fallback = safeFallback();
      addAssistant(fallback.text, fallback.links || []);
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  function addAssistant(text, links) { addMessage('assistant', text, links); }
  function addMessage(role, text, links) {
    const bubble = document.createElement('div');
    bubble.className = `msg ${role}`;
    bubble.textContent = text;
    if (links?.length) {
      const row = document.createElement('div');
      row.className = 'links';
      links.slice(0, 3).forEach((item) => {
        if (!item?.href || !item?.label) return;
        const anchor = document.createElement('a');
        anchor.className = 'link';
        anchor.href = item.href;
        anchor.textContent = item.label;
        if (/^https:\/\//i.test(item.href)) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        }
        row.appendChild(anchor);
      });
      bubble.appendChild(row);
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'msg assistant';
    const typing = document.createElement('span');
    typing.className = 'typing';
    for (let i = 0; i < 3; i += 1) typing.appendChild(document.createElement('span'));
    bubble.appendChild(typing);
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function iconBubble() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M7.5 18.5 4 20l1-3.8A8 8 0 1 1 7.5 18.5Z');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linejoin', 'round');
    const dots = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dots.setAttribute('d', 'M8 12h.01M12 12h.01M16 12h.01');
    dots.setAttribute('stroke', 'currentColor');
    dots.setAttribute('stroke-width', '2.2');
    dots.setAttribute('stroke-linecap', 'round');
    svg.append(path, dots);
    return svg;
  }
})();
