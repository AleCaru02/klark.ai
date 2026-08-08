(() => {
  'use strict';
  if (window.__clarkPublicAssistantLoaded) return;
  window.__clarkPublicAssistantLoaded = true;

  const FUNCTIONS_BASE = 'https://weufeilkdzimmmgskobs.supabase.co/functions/v1';
  const WIDGET_KEY = '21332d02-8c76-458b-9961-267db3044205';
  const SUPPORT_EMAIL = 'info@clerkai.it';
  const state = { sessionId: '', sessionToken: '', bootstrapPromise: null };

  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  async function bootstrap() {
    if (state.sessionId && state.sessionToken) return;
    if (state.bootstrapPromise) return state.bootstrapPromise;
    state.bootstrapPromise = fetch(`${FUNCTIONS_BASE}/site-chat-bootstrap?key=${encodeURIComponent(WIDGET_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clark-widget': 'public-site' },
      body: '{}',
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.session_id || !data.session_token) throw new Error(data.error || `Bootstrap ${response.status}`);
      state.sessionId = data.session_id;
      state.sessionToken = data.session_token;
    }).finally(() => { state.bootstrapPromise = null; });
    return state.bootstrapPromise;
  }

  async function askBackend(message) {
    await bootstrap();
    const response = await fetch(`${FUNCTIONS_BASE}/site-chat-message?key=${encodeURIComponent(WIDGET_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clark-widget': 'public-site' },
      body: JSON.stringify({ session_id: state.sessionId, session_token: state.sessionToken, message }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      state.sessionId = '';
      state.sessionToken = '';
      await bootstrap();
      return askBackend(message);
    }
    if (!response.ok || !data.answer) throw new Error(data.error || `Chat ${response.status}`);
    return { text: data.answer, links: sourceLinks(data.sources || []) };
  }

  function sourceLinks(sources) {
    const seen = new Set();
    return sources
      .filter((source) => source && source.url && /^https:\/\//i.test(source.url))
      .filter((source) => !seen.has(source.url) && seen.add(source.url))
      .slice(0, 3)
      .map((source) => ({ label: source.name || 'Approfondisci', href: source.url }));
  }

  function fallbackAnswer(raw) {
    const q = normalize(raw);
    const asksMetaLeadFlow = /(facebook|meta|lead ads|facebook ads|ads|campagn|modulo|form).*?(contatt|lead|richiam|chiam|follow|followup|follow-up|floow|follw)|((contatt|lead).*?(facebook|meta|ads|campagn))/.test(q);

    if (asksMetaLeadFlow) {
      return {
        text: 'Sì. Questo è uno dei flussi principali di ClerkAI nel piano Growth e superiori: il contatto arriva da Meta/Facebook Lead Ads, viene associato al cliente corretto e inserito nel CRM; ClerkAI può avviare la prima chiamata automatica secondo le regole configurate, registrare l’esito e proseguire con follow-up. Se non risponde, il workflow può inviare WhatsApp e programmare nuovi tentativi con orari, intervalli, numero massimo di chiamate e condizioni di stop personalizzabili. Quando il lead risponde, può essere qualificato e, se serve, fissare un appuntamento sul Google Calendar collegato. Le chiamate commerciali e i messaggi devono essere configurati nel rispetto dei consensi e delle preferenze di contatto.',
        links: [{ label: 'Vedi Growth', href: '/pricing' }, { label: 'Analizza il flusso', href: '/analisi-flusso' }],
      };
    }

    if (/property manager|property management|gestione affitti|affitti brevi|host|case vacanza|gestione immobiliare|agenzia immobiliare|immobiliar|condomini|amministratore/.test(q)) {
      return {
        text: 'Sì. Per un property manager ClerkAI può gestire sia acquisizione sia operatività: richiamare lead da Facebook Ads, qualificare proprietari o ospiti, raccogliere zona e tipo di immobile, fissare call o sopralluoghi, rispondere a FAQ approvate, gestire richieste e richiami, aggiornare il CRM e inviare follow-up WhatsApp. Per lead + chiamate automatiche + WhatsApp + chatbot sito il piano più coerente è Growth; Pro ha senso con più campagne, flussi, calendari o volumi maggiori. Urgenze, reclami e decisioni economiche possono essere inoltrati a una persona con il contesto già raccolto.',
        links: [{ label: 'Gestione immobiliare', href: '/settori/gestione-immobiliare' }, { label: 'Confronta i piani', href: '/pricing' }],
      };
    }

    if (/parrucch|barbier|salone|hair stylist|hairdresser|estetic|nail|spa|beauty/.test(q)) {
      return {
        text: 'Sì. Per un parrucchiere o un salone ClerkAI può rispondere mentre stai lavorando, spiegare servizi e prezzi presenti nella knowledge base, raccogliere il trattamento richiesto, controllare disponibilità, prenotare/spostare/cancellare appuntamenti, inviare promemoria WhatsApp e registrare richieste di richiamo. Essential è il punto di partenza per chiamate + agenda; Growth è più adatto se vuoi anche WhatsApp, chatbot sito, lead e follow-up.',
        links: [{ label: 'Confronta i piani', href: '/pricing' }],
      };
    }

    if (/ristorant|pizzer|trattoria|locale|bar\b/.test(q)) return { text: 'Per un ristorante ClerkAI può rispondere a richieste frequenti, raccogliere prenotazioni, numero di persone e orario, gestire richiami e inviare conferme. La conferma automatica richiede un calendario o sistema compatibile configurato; allergie, eccezioni e richieste particolari possono essere passate a una persona.', links: [{ label: 'Analizza il tuo flusso', href: '/analisi-flusso' }] };

    if (/palestr|fitness|personal trainer|centro sport|yoga|pilates/.test(q)) return { text: 'Per palestra, studio fitness o personal trainer ClerkAI può rispondere alle chiamate, qualificare nuovi contatti, fissare prove o appuntamenti, inviare promemoria, fare follow-up e aggiornare il CRM. Growth è normalmente il piano più adatto quando vuoi unire chiamate, WhatsApp, lead e follow-up.', links: [{ label: 'Vedi Growth', href: '/pricing' }] };

    if (/dentist|medic|studio sanitario|clinica|fisioter|psicolog|veterinar/.test(q)) return { text: 'Per uno studio sanitario ClerkAI può gestire segreteria e agenda: appuntamenti, spostamenti, cancellazioni, dati amministrativi, promemoria e inoltro richieste. Non deve formulare diagnosi o fornire indicazioni cliniche: le decisioni sanitarie restano al professionista.', links: [{ label: 'Studi sanitari', href: '/settori/studi-sanitari' }] };

    if (/avvocat|commercialist|consulent|studio professionale|architett|geometr|ingegner/.test(q)) return { text: 'Per uno studio professionale ClerkAI può fare intake iniziale, raccogliere motivo della richiesta e recapiti, fissare appuntamenti, gestire richiami e passare al professionista le domande specialistiche con il contesto già raccolto. Non sostituisce il professionista nelle valutazioni riservate.', links: [{ label: 'Studi professionali', href: '/settori/studi-professionali' }] };

    if (/prezz|cost|quanto costa|pian[oi]|essential|growth|pro|enterprise|attivaz|setup/.test(q)) {
      return {
        text: 'I piani pubblici attuali sono Essential 199 €/mese, Growth 399 €/mese, Pro 749 €/mese ed Enterprise da 1.290 €/mese, con fatturazione trimestrale e impegno minimo di 3 mesi. La configurazione standard e il collaudo iniziale sono inclusi in Essential, Growth e Pro: non c’è una fee di attivazione separata. Enterprise e integrazioni o sviluppi fuori standard vengono quotati prima dell’avvio. Essential include 200 minuti voce/mese, Growth 650 minuti e 1.500 risposte chatbot/mese, Pro 1.500 minuti e 5.000 risposte chatbot/mese. Voce extra: 0,39 €/min equivalente; WhatsApp dipende dalle tariffe Meta applicabili.',
        links: [{ label: 'Prezzi completi', href: '/pricing' }],
      };
    }

    if (/sicurezza|privacy|gdpr|dati|registr|trascr/.test(q)) return { text: 'ClerkAI è progettato con separazione multi-tenant, controlli di accesso, segreti lato server e retention configurabile. Registrazione e trascrizione sono opt-in. La piattaforma fornisce controlli tecnici, ma informative, basi giuridiche, consensi, DPA e configurazione dei provider devono essere verificati prima della produzione.', links: [{ label: 'Privacy', href: '/privacy' }] };

    if (/come funziona|cosa fa|appuntament|calendar|whatsapp|crm|lead|chiamat|telefon|chatbot|follow|richiam/.test(q)) return { text: 'ClerkAI collega chiamate, agenda, CRM e, nei piani previsti, WhatsApp, Meta Lead Ads e chatbot sito. Può capire la richiesta, raccogliere dati, qualificare il contatto, prenotare/spostare/cancellare appuntamenti, eseguire follow-up configurati e lasciare nel CRM esito e prossima azione. I casi non gestibili vengono fermati o passati a una persona.', links: [{ label: 'Come funziona', href: '/presentazione' }, { label: 'Demo operativa', href: '/demo-operativa' }] };

    if (/sono (un|una)|ho (un|una)|gestisco (un|una)|lavoro come|faccio il|faccio la/.test(q)) return { text: 'Probabilmente sì se la tua attività riceve chiamate, lead, richieste ripetitive o appuntamenti. ClerkAI può rispondere, qualificare il contatto, usare le informazioni approvate della tua attività, gestire agenda e follow-up e passare le eccezioni a una persona. Scrivimi il settore e come arrivano oggi i contatti — telefono, Facebook Ads, WhatsApp o sito — e ti indico il flusso concreto e il piano più coerente.', links: [{ label: 'Analizza il tuo flusso', href: '/analisi-flusso' }] };

    return { text: `Posso rispondere su tutto ciò che riguarda ClerkAI: funzioni, flussi Meta/Facebook Ads, chiamate, follow-up, WhatsApp, CRM, chatbot, Google Calendar, prezzi, sicurezza, onboarding e casi d’uso. Scrivimi cosa succede oggi nella tua attività e ti dico concretamente cosa può automatizzare ClerkAI e cosa deve restare umano. Per richieste commerciali specifiche puoi anche scrivere a ${SUPPORT_EMAIL}.`, links: [{ label: 'Analizza il tuo flusso', href: '/analisi-flusso' }] };
  }

  async function getAnswer(message) {
    try { return await askBackend(message); }
    catch (error) { console.warn('[ClerkAI site assistant] AI backend unavailable, using safe fallback.', error); return fallbackAnswer(message); }
  }

  const host = document.createElement('div');
  host.id = 'clark-public-assistant-host';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial} *,*::before,*::after{box-sizing:border-box} button,input{font:inherit}
    .launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;border:1px solid #bae6fd;border-radius:999px;background:#e0f2fe;color:#0369a1;box-shadow:0 14px 38px rgba(14,165,233,.18);cursor:pointer;display:grid;place-items:center}
    .launcher:focus-visible,.close:focus-visible,.send:focus-visible,.chip:focus-visible,.link:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}.launcher svg{width:25px;height:25px}
    .panel{position:fixed;right:16px;bottom:90px;z-index:2147482999;width:min(410px,calc(100vw - 24px));height:min(660px,calc(100dvh - 112px));display:none;flex-direction:column;overflow:hidden;background:#fff;color:#0f172a;border:1px solid #bae6fd;border-radius:20px;box-shadow:0 24px 80px rgba(14,165,233,.16);font:14px/1.48 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.panel.open{display:flex}
    .header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px 13px;background:linear-gradient(135deg,#f0f9ff,#ecfeff);color:#0f172a;border-bottom:1px solid #bae6fd;flex:0 0 auto}.eyebrow{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.82;margin-bottom:2px}.status{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.15)}.title{font-size:16px;font-weight:760;line-height:1.25}.subtitle{font-size:12px;line-height:1.35;opacity:.82;margin-top:4px;max-width:300px}.close{border:0;background:transparent;color:#475569;cursor:pointer;font-size:24px;line-height:1;padding:0 2px;flex:0 0 auto}
    .messages{flex:1 1 auto;min-height:0;overflow:auto;background:#f8fafc;padding:12px;display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}.msg{max-width:88%;border-radius:14px;padding:9px 11px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.48}.assistant{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a}.user{align-self:flex-end;background:#e0f2fe;border:1px solid #bae6fd;color:#0f172a}.links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.link{display:inline-flex;align-items:center;border:1px solid #dbe3ef;border-radius:999px;padding:5px 8px;text-decoration:none;color:#0369a1;background:#f0f9ff;font-size:11.5px;font-weight:650}
    .suggestions{flex:0 0 auto;padding:8px 10px 0;background:#fff;display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}.suggestions::-webkit-scrollbar{display:none}.chip{flex:0 0 auto;max-width:260px;border:1px solid #dbe3ef;background:#fff;color:#334155;border-radius:999px;padding:6px 9px;cursor:pointer;font-size:11.5px;line-height:1.25;white-space:nowrap}
    .composer{flex:0 0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:9px 10px;background:#fff;border-top:1px solid #e5e7eb}.input{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;color:#0f172a;background:#fff;outline:none;font-size:16px;line-height:1.25}.input:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(125,211,252,.25)}.send{min-width:64px;border:0;border-radius:10px;background:#0284c7;color:#fff;padding:9px 12px;font-weight:700;cursor:pointer;font-size:13px}.send:disabled{opacity:.55;cursor:not-allowed}.note{flex:0 0 auto;padding:0 10px 9px;background:#fff;color:#64748b;font-size:10px;line-height:1.35}
    .typing{display:inline-flex;gap:4px;align-items:center}.typing span{width:5px;height:5px;background:#94a3b8;border-radius:50%;animation:pulse 1s infinite}.typing span:nth-child(2){animation-delay:.12s}.typing span:nth-child(3){animation-delay:.24s}@keyframes pulse{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-2px)}}
    @media(max-width:520px){.panel{top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));left:max(8px,env(safe-area-inset-left));width:auto;max-width:none;height:auto;max-height:none;border-radius:16px}.launcher{right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));width:54px;height:54px}.header{padding:13px 13px 11px}.title{font-size:15px}.subtitle{font-size:11px;max-width:250px}.eyebrow{font-size:9.5px}.messages{padding:10px;gap:8px}.msg{max-width:92%;font-size:13.5px;padding:8px 10px}.suggestions{padding:7px 9px 0}.chip{font-size:11px;max-width:230px;padding:6px 8px}.composer{padding:8px 9px;gap:6px}.send{min-width:58px;padding:8px 10px}.note{padding:0 9px max(8px,env(safe-area-inset-bottom));font-size:9.5px}}
    @media(max-width:360px){.subtitle{display:none}.msg{max-width:95%;font-size:13px}.chip{max-width:200px}.send{min-width:54px;padding:8px 9px}}@media(prefers-reduced-motion:reduce){.messages{scroll-behavior:auto}.typing span{animation:none}}
  `;

  const launcher = document.createElement('button'); launcher.type = 'button'; launcher.className = 'launcher'; launcher.setAttribute('aria-label', 'Apri assistente AI ClerkAI'); launcher.setAttribute('aria-expanded', 'false'); launcher.appendChild(iconBubble());
  const panel = document.createElement('section'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistente AI ClerkAI');
  const header = document.createElement('header'); header.className = 'header'; const headerCopy = document.createElement('div'); const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; const status = document.createElement('span'); status.className = 'status'; const eyebrowText = document.createElement('span'); eyebrowText.textContent = 'Assistente AI del sito'; eyebrow.append(status, eyebrowText); const title = document.createElement('div'); title.className = 'title'; title.textContent = 'Chiedimi qualsiasi cosa su ClerkAI'; const subtitle = document.createElement('div'); subtitle.className = 'subtitle'; subtitle.textContent = 'Funzioni, prezzi, settori, sicurezza e valutazione del tuo caso'; headerCopy.append(eyebrow, title, subtitle); const close = document.createElement('button'); close.type = 'button'; close.className = 'close'; close.setAttribute('aria-label', 'Chiudi assistente'); close.textContent = '×'; header.append(headerCopy, close);
  const messages = document.createElement('div'); messages.className = 'messages'; messages.setAttribute('aria-live', 'polite');
  const suggestions = document.createElement('div'); suggestions.className = 'suggestions'; ['Ricevo molti lead: può richiamarli?', 'Sono un property manager: mi può servire?', 'Quanto costa?', 'Come funziona il follow-up?'].forEach((question) => { const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'chip'; chip.textContent = question; chip.addEventListener('click', () => submitQuestion(question)); suggestions.appendChild(chip); });
  const form = document.createElement('form'); form.className = 'composer'; const input = document.createElement('input'); input.className = 'input'; input.type = 'text'; input.maxLength = 1500; input.autocomplete = 'off'; input.placeholder = 'Scrivi la tua domanda…'; input.setAttribute('aria-label', 'Domanda'); const send = document.createElement('button'); send.type = 'submit'; send.className = 'send'; send.textContent = 'Invia'; form.append(input, send);
  const note = document.createElement('div'); note.className = 'note'; note.textContent = 'AI basata sulla knowledge base ufficiale ClerkAI. Non inserire password, documenti o dati sensibili.'; panel.append(header, messages, suggestions, form, note); root.append(style, panel, launcher);
  addAssistant('Ciao. Posso spiegarti ClerkAI e valutare il tuo caso concreto: settore, chiamate, appuntamenti, richieste fuori orario, passaggio a una persona, prezzi e sicurezza. Scrivimi cosa vuoi semplificare.', [{ label: 'Confronta i piani', href: '/pricing' }]);

  launcher.addEventListener('click', () => { const open = !panel.classList.contains('open'); panel.classList.toggle('open', open); launcher.setAttribute('aria-expanded', String(open)); if (open) { setTimeout(() => input.focus(), 0); bootstrap().catch(() => {}); } });
  close.addEventListener('click', () => { panel.classList.remove('open'); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); });
  form.addEventListener('submit', (event) => { event.preventDefault(); submitQuestion(input.value); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); } });

  async function submitQuestion(value) { const question = String(value || '').trim(); if (!question || send.disabled) return; input.value = ''; addUser(question); send.disabled = true; const typing = addTyping(); try { const result = await getAnswer(question); typing.remove(); addAssistant(result.text, result.links || []); } catch { typing.remove(); const fallback = fallbackAnswer(question); addAssistant(fallback.text, fallback.links || []); } finally { send.disabled = false; input.focus(); } }
  function addUser(text) { addMessage('user', text, []); } function addAssistant(text, links) { addMessage('assistant', text, links || []); }
  function addMessage(role, text, links) { const bubble = document.createElement('div'); bubble.className = `msg ${role}`; bubble.textContent = text; if (links.length) { const row = document.createElement('div'); row.className = 'links'; links.slice(0, 3).forEach((item) => { const a = document.createElement('a'); a.className = 'link'; a.href = item.href; a.textContent = item.label; if (/^https:\/\//i.test(item.href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } row.appendChild(a); }); bubble.appendChild(row); } messages.appendChild(bubble); messages.scrollTop = messages.scrollHeight; }
  function addTyping() { const bubble = document.createElement('div'); bubble.className = 'msg assistant'; const typing = document.createElement('span'); typing.className = 'typing'; for (let i = 0; i < 3; i += 1) typing.appendChild(document.createElement('span')); bubble.appendChild(typing); messages.appendChild(bubble); messages.scrollTop = messages.scrollHeight; return bubble; }
  function iconBubble() { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true'); const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M7.5 18.5 4 20l1-3.8A8 8 0 1 1 7.5 18.5Z'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8'); path.setAttribute('stroke-linejoin', 'round'); const dots = document.createElementNS('http://www.w3.org/2000/svg', 'path'); dots.setAttribute('d', 'M8 12h.01M12 12h.01M16 12h.01'); dots.setAttribute('stroke', 'currentColor'); dots.setAttribute('stroke-width', '2.2'); dots.setAttribute('stroke-linecap', 'round'); svg.append(path, dots); return svg; }
})();