# Chatbot sito multi-tenant — architettura e controlli

## Modello di proprietà

Ogni organizzazione dispone di configurazione, domini, knowledge base, conversazioni, lead, calendario e collegamenti provider propri.

Gestiti centralmente dalla piattaforma:

- Stripe e fatturazione;
- OpenAI;
- ElevenLabs;
- Supabase;
- email transazionali;
- account Twilio master.

Gestiti o autorizzati dal singolo tenant:

- Google Calendar OAuth;
- Meta Business, pagine e Lead Ads;
- WhatsApp Business Account e numero;
- sito e domini autorizzati;
- documenti e fonti knowledge;
- orari, servizi, escalation e workflow;
- numero voce italiano in un subaccount Twilio dedicato.

## Contratto pubblico del widget

Il sito del cliente riceve soltanto:

- URL dello script pubblico;
- chiave widget UUID revocabile;
- URL delle Edge Functions.

Non riceve:

- tenant ID;
- JWT Supabase;
- service role;
- token Google, Meta o WhatsApp;
- chiavi OpenAI, ElevenLabs o Twilio;
- prompt interni.

## Controlli applicati

1. **Allowlist dei domini** — la chiave funziona solo sugli origin configurati.
2. **Sessioni firmate** — token casuale; nel database viene conservato solo l'HMAC.
3. **IP minimizzato** — viene conservato soltanto un HMAC dell'indirizzo, non l'IP in chiaro.
4. **Rate limiting** — limite di sessioni per IP, messaggi al minuto, messaggi per sessione e quota mensile.
5. **RLS e privilegi** — nessuna tabella chatbot è accessibile al ruolo anon; gli utenti autenticati vedono solo il proprio tenant.
6. **Knowledge governance** — sono utilizzate solo fonti completate, approvate e non scadute.
7. **Prompt injection** — richieste di prompt, segreti o modifica delle istruzioni vengono bloccate.
8. **Aree ad alto rischio** — niente diagnosi, prescrizioni o consulenza legale/finanziaria personalizzata.
9. **Escalation** — bassa confidenza e richiesta esplicita possono creare un passaggio umano nel CRM del tenant.
10. **Consenso** — i dati identificativi non vengono acquisiti senza il consenso configurato.
11. **Retention** — sessioni e messaggi vengono eliminati secondo la retention del chatbot.
12. **Key rotation** — ruotare la chiave disattiva il widget e revoca le sessioni attive.
13. **Rendering sicuro** — il widget usa Shadow DOM e `textContent`, non inserisce HTML prodotto dal modello.
14. **Fail closed** — il widget resta disattivato senza dominio, fonte approvata e segreti server.

## Segreti obbligatori

Configurare esclusivamente nei segreti delle Edge Functions:

- `OPENAI_API_KEY`;
- `CHATBOT_SESSION_SECRET`;
- `CHATBOT_IP_HASH_SALT`;
- `APP_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- opzionalmente le tariffe interne per la stima dei costi.

`CHATBOT_SESSION_SECRET` e `CHATBOT_IP_HASH_SALT` devono essere valori indipendenti e ad alta entropia. Non usare valori uguali né inserirli nel frontend.

## Criteri prima del go-live di un tenant

- piano Growth, Pro o Enterprise attivo;
- almeno un dominio valido;
- almeno una fonte approvata e non scaduta;
- testo consenso approvato;
- CRM ed escalation verificati;
- Google collegato prima di consentire conferme appuntamento;
- test origine autorizzata e origine non autorizzata;
- test rate limit;
- test isolamento Tenant A/Tenant B;
- test rotazione chiave;
- test retention;
- budget OpenAI e allerta costi configurati.

## Limite attuale sulle prenotazioni

Il chatbot può raccogliere una richiesta appuntamento e creare il relativo lead. Non deve dichiarare un appuntamento confermato finché non utilizza il servizio calendario server-only con verifica dello slot, idempotenza e compensazione degli errori esterni.
