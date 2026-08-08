(() => {
  "use strict";

  const script = document.currentScript;
  if (!script) return;
  const widgetKey = (script.dataset.widgetKey || "").trim();
  const apiBase = (script.dataset.apiBase || "").trim().replace(/\/$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(widgetKey) || !/^https:\/\//i.test(apiBase)) {
    console.error("Clark Chat: data-widget-key e data-api-base sono obbligatori.");
    return;
  }
  if (document.querySelector(`[data-clark-chat-root="${widgetKey}"]`)) return;

  const root = document.createElement("div");
  root.dataset.clarkChatRoot = widgetKey;
  document.body.appendChild(root);
  const shadow = root.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box}button,input{font:inherit}
    .launcher{position:fixed;z-index:2147483000;bottom:20px;width:58px;height:58px;border:0;border-radius:50%;background:#2563eb;color:white;box-shadow:0 12px 32px rgba(0,0,0,.24);cursor:pointer;font:700 24px/1 system-ui,sans-serif}
    .right{right:20px}.left{left:20px}
    .panel{position:fixed;z-index:2147482999;bottom:90px;width:min(390px,calc(100vw - 24px));height:min(610px,calc(100vh - 120px));background:white;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}
    .panel.open{display:flex}.panel.right{right:12px}.panel.left{left:12px}
    .header{padding:14px 16px;color:white;display:flex;align-items:center;justify-content:space-between;gap:12px}.title{font-weight:700}.subtitle{font-size:12px;opacity:.88}.close{border:0;background:transparent;color:white;font-size:24px;cursor:pointer;padding:0 4px}
    .messages{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}.msg{max-width:86%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere}.assistant{align-self:flex-start;background:white;border:1px solid #e5e7eb}.user{align-self:flex-end;color:white}.sources{font-size:11px;margin-top:8px;border-top:1px solid #e5e7eb;padding-top:6px}.sources a{color:inherit}
    .identity{padding:10px 12px;border-top:1px solid #e5e7eb;background:white;display:grid;gap:7px}.identity.hidden{display:none}.identity input{width:100%;border:1px solid #d1d5db;border-radius:9px;padding:9px;color:#111827;background:white}.consent{display:flex;gap:8px;align-items:flex-start;font-size:11px;color:#4b5563}.consent input{width:auto;margin-top:2px}
    .composer{padding:10px;border-top:1px solid #e5e7eb;background:white;display:flex;gap:8px}.composer input{flex:1;min-width:0;border:1px solid #d1d5db;border-radius:10px;padding:10px;color:#111827;background:white}.send,.handoff{border:0;border-radius:10px;padding:9px 12px;color:white;cursor:pointer;font-weight:600}.handoff{margin:0 10px 10px;background:#374151}.status{padding:7px 12px;font-size:11px;color:#6b7280;background:#fff}.error{color:#b91c1c}.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:480px){.panel{inset:12px 12px 84px 12px;width:auto;height:auto}.launcher{bottom:16px}.right{right:16px}.left{left:16px}}
  `;
  shadow.appendChild(style);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher right";
  launcher.setAttribute("aria-label", "Apri assistente");
  launcher.textContent = "✦";

  const panel = document.createElement("section");
  panel.className = "panel right";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat con assistente AI");

  const header = document.createElement("header");
  header.className = "header";
  const headerText = document.createElement("div");
  const title = document.createElement("div"); title.className = "title"; title.textContent = "Assistente";
  const subtitle = document.createElement("div"); subtitle.className = "subtitle"; subtitle.textContent = "Assistente AI · verifica sempre le informazioni importanti";
  headerText.append(title, subtitle);
  const close = document.createElement("button"); close.type = "button"; close.className = "close"; close.setAttribute("aria-label", "Chiudi chat"); close.textContent = "×";
  header.append(headerText, close);

  const messages = document.createElement("div"); messages.className = "messages"; messages.setAttribute("aria-live", "polite");
  const identity = document.createElement("div"); identity.className = "identity";
  const nameInput = input("Nome", "name", "text");
  const emailInput = input("Email", "email", "email");
  const phoneInput = input("Telefono", "phone", "tel");
  const consentLabel = document.createElement("label"); consentLabel.className = "consent";
  const consentInput = document.createElement("input"); consentInput.type = "checkbox";
  const consentText = document.createElement("span"); consentText.textContent = "Accetto il trattamento dei dati per ricevere una risposta.";
  consentLabel.append(consentInput, consentText);
  identity.append(nameInput, emailInput, phoneInput, consentLabel);

  const handoff = document.createElement("button"); handoff.type = "button"; handoff.className = "handoff"; handoff.textContent = "Parla con una persona";
  const composer = document.createElement("form"); composer.className = "composer";
  const messageInput = document.createElement("input"); messageInput.type = "text"; messageInput.maxLength = 1500; messageInput.placeholder = "Scrivi una domanda…"; messageInput.autocomplete = "off"; messageInput.required = true;
  const send = document.createElement("button"); send.type = "submit"; send.className = "send"; send.textContent = "Invia";
  composer.append(messageInput, send);
  const status = document.createElement("div"); status.className = "status"; status.textContent = "La chat usa solo fonti approvate dall’attività.";
  panel.append(header, messages, identity, handoff, composer, status);
  shadow.append(launcher, panel);

  let config = null;
  let session = readSession();
  let initialized = false;
  let busy = false;

  launcher.addEventListener("click", async () => {
    panel.classList.toggle("open");
    launcher.setAttribute("aria-expanded", String(panel.classList.contains("open")));
    if (panel.classList.contains("open")) {
      if (!initialized) await bootstrap();
      messageInput.focus();
    }
  });
  close.addEventListener("click", () => { panel.classList.remove("open"); launcher.focus(); });
  composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text || busy) return;
    addMessage("user", text);
    messageInput.value = "";
    await sendRequest("message", text);
  });
  handoff.addEventListener("click", async () => {
    if (busy) return;
    await sendRequest("handoff", "Richiedo di parlare con una persona.");
  });

  async function bootstrap(force = false) {
    setBusy(true, "Connessione in corso…");
    try {
      if (force) clearSession();
      const response = await fetch(`${apiBase}/site-chat-bootstrap?key=${encodeURIComponent(widgetKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Clark-Widget": widgetKey },
        body: "{}",
      });
      if (!response.ok) throw new Error("Widget non disponibile su questo dominio.");
      const payload = await response.json();
      session = { id: payload.session_id, token: payload.session_token, expiresAt: payload.expires_at };
      config = payload.config;
      sessionStorage.setItem(storageKey(), JSON.stringify(session));
      applyConfig();
      messages.textContent = "";
      addMessage("assistant", config.welcome_message || "Ciao. Come posso aiutarti?");
      initialized = true;
      setBusy(false, "La chat usa solo fonti approvate dall’attività.");
    } catch (error) {
      setBusy(false, error instanceof Error ? error.message : "Chat non disponibile.", true);
    }
  }

  async function sendRequest(action, text) {
    if (!session || Date.parse(session.expiresAt) <= Date.now()) await bootstrap(true);
    if (!session) return;
    setBusy(true, "Elaborazione…");
    try {
      const response = await fetch(`${apiBase}/site-chat-message?key=${encodeURIComponent(widgetKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Clark-Widget": widgetKey },
        body: JSON.stringify({
          session_id: session.id,
          session_token: session.token,
          action,
          message: text,
          consent: consentInput.checked,
          contact: {
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        await bootstrap(true);
        throw new Error("Sessione rinnovata. Invia nuovamente il messaggio.");
      }
      if (!response.ok) throw new Error(payload.answer || payload.error || "Richiesta non completata.");
      addMessage("assistant", payload.answer || "Richiesta registrata.", payload.sources || []);
      if (payload.handoff) handoff.disabled = true;
      setBusy(false, payload.safety_status === "limited" ? "Risposta limitata: è consigliata una verifica umana." : "Risposta generata usando le fonti approvate.");
    } catch (error) {
      setBusy(false, error instanceof Error ? error.message : "Errore temporaneo.", true);
    }
  }

  function applyConfig() {
    const accent = /^#[0-9a-f]{6}$/i.test(config.accent_color || "") ? config.accent_color : "#2563eb";
    title.textContent = config.display_name || "Assistente";
    header.style.background = accent;
    launcher.style.background = accent;
    send.style.background = accent;
    documentPosition(config.position === "left" ? "left" : "right");
    nameInput.hidden = !config.collect_name;
    emailInput.hidden = !config.collect_email;
    phoneInput.hidden = !config.collect_phone;
    consentLabel.hidden = !config.require_consent;
    consentInput.required = Boolean(config.require_consent);
    consentText.textContent = config.consent_text || consentText.textContent;
    handoff.hidden = !config.escalation_enabled;
    handoff.textContent = config.human_label || "Parla con una persona";
    identity.classList.toggle("hidden", !config.collect_name && !config.collect_email && !config.collect_phone && !config.require_consent);
  }

  function documentPosition(position) {
    launcher.classList.remove("left", "right"); panel.classList.remove("left", "right");
    launcher.classList.add(position); panel.classList.add(position);
  }

  function addMessage(role, text, sources = []) {
    const bubble = document.createElement("div"); bubble.className = `msg ${role}`; bubble.textContent = text;
    if (role === "user" && config?.accent_color) bubble.style.background = config.accent_color;
    if (sources.length) {
      const list = document.createElement("div"); list.className = "sources"; list.append(document.createTextNode("Fonti: "));
      sources.slice(0, 3).forEach((source, index) => {
        if (index) list.append(document.createTextNode(", "));
        if (source.url && /^https:\/\//i.test(source.url)) {
          const link = document.createElement("a"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = source.name;
          list.append(link);
        } else list.append(document.createTextNode(source.name || "Fonte approvata"));
      });
      bubble.append(list);
    }
    messages.append(bubble); messages.scrollTop = messages.scrollHeight;
  }

  function setBusy(value, text, isError = false) {
    busy = value; send.disabled = value; handoff.disabled = value; messageInput.disabled = value;
    status.textContent = text; status.classList.toggle("error", isError);
  }

  function input(placeholder, name, type) {
    const element = document.createElement("input"); element.placeholder = placeholder; element.name = name; element.type = type; element.maxLength = type === "email" ? 254 : 160; return element;
  }
  function storageKey() { return `clark-chat:${widgetKey}`; }
  function readSession() {
    try { const value = JSON.parse(sessionStorage.getItem(storageKey()) || "null"); return value?.id && value?.token && value?.expiresAt ? value : null; } catch { return null; }
  }
  function clearSession() { sessionStorage.removeItem(storageKey()); session = null; }
})();
