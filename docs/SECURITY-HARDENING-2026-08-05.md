# Security hardening e readiness — 5 agosto 2026

## Stato

Il progetto è in **pre-produzione**. La pull request deve restare in bozza finché provider, billing, dominio e test end-to-end non sono verificati.

## Repository e backend

- repository operativo: `AleCaru02/assistant-call-sync`;
- progetto Lovable: `assistant-call-sync`;
- repository `AleCaru02/klark.ai`: non contiene l'applicazione;
- backend collegato al progetto Lovable: Supabase `weufeilkdzimmmgskobs`;
- Vercel: nessun progetto collegato al momento dell'audit.

## Hardening completato

### Segreti e accessi

- `.env` rimosso dal versionamento;
- `.env.example` privo di valori reali;
- segreti provider previsti soltanto come Edge Function secrets;
- tabelle `tenant_secrets`, `oauth_states`, `provider_events`, `google_watch_channels` e `platform_admins` server-only;
- bucket knowledge e audio privati;
- platform admin separato dai ruoli del tenant;
- registrazione pubblica rimossa dal frontend.

### Webhook e OAuth

- firme obbligatorie per Stripe, Twilio, Meta Lead Ads e WhatsApp;
- eventi provider deduplicati;
- OAuth state opaco, monouso e con scadenza;
- callback pubbliche limitate agli endpoint che non possono presentare JWT;
- endpoint ElevenLabs protetto da JWT, utente autenticato, allowlist voci, limite testo e flag server disabilitato di default;
- demo pubblica sostituita con sintesi locale senza consumo provider.

### Multi-tenant

- RLS attiva su tutte le 51 tabelle pubbliche;
- campi tenant e ruolo protetti;
- relazioni cross-tenant vincolate;
- credenziali WhatsApp specifiche del tenant;
- token OAuth conservati in tabelle non leggibili dal browser;
- funzioni tenant-scoped e amministrative con `search_path` fissato.

### Worker e flussi

- claim atomici per coda chiamate e reminder;
- lock, retry e backoff;
- idempotenza provider;
- consenso AI richiesto prima dell'elaborazione di trascrizioni;
- prenotazione con timezone, preavviso, overlap e controllo free/busy;
- compensazione quando un'azione sul provider fallisce;
- comandi WhatsApp tenant-scoped.

### Prodotto e comunicazione

- prezzi e caratteristiche centralizzati;
- rimosse testimonianze, immagini, metriche, società, telefono e social non verificati;
- sostituiti i claim assoluti con standard operativi;
- checkout dichiarato non attivo;
- privacy, termini e cookie indicati come documenti pre-lancio;
- SEO privata con `noindex` per login, checkout, dashboard e admin;
- configurazione Vercel preparata per SPA e header di sicurezza;
- dashboard con blocchi espliciti di prontezza produzione.

## Verifica reale backend

Audit in sola lettura:

- 51/51 tabelle pubbliche con RLS;
- 0 cron attivi;
- 1 tenant e 1 membership;
- 0 sottoscrizioni attive;
- 0 numeri, integrazioni, chiamate, appuntamenti, messaggi e contatti;
- bucket `tenant-knowledge` e `voice-audio` privati;
- nessun valore attivo nella colonna legacy `settings.facebook_webhook_secret` o in `tenant_secrets`.

Consultare `docs/BACKEND-AUDIT-2026-08-05.md`.

## Controlli CI

Il workflow Quality verifica:

- TypeScript;
- test frontend e integrità commerciale;
- build Vite;
- test crittografici;
- `deno check` delle Edge Functions modificate;
- assenza di file ambiente versionati;
- assenza di identità e contatti segnaposto.

## Blocchi obbligatori

### P0 — prima di qualsiasi cliente o chiamata reale

1. Scegliere nome, dominio, email e identità legale definitivi.
2. Riconciliare la migration history del database.
3. Rimuovere la colonna legacy `settings.facebook_webhook_secret` tramite migrazione verificata.
4. Approvare un unico listino: frontend, tabella `plans`, Stripe, contratto e dashboard oggi divergono.
5. Configurare e ruotare tutti i secret provider.
6. Distribuire Edge Functions in preview.
7. Verificare firme positive e negative, replay, idempotenza e tenant isolation.
8. Collegare un progetto Vercel preview con variabili frontend sicure.
9. Configurare Twilio, Google, Meta, WhatsApp, Stripe, Resend ed eventuale ElevenLabs.
10. Testare chiamata reale, agenda, messaggi, errori e compensazioni.

### P1 — prima del go-live commerciale

1. Approvare privacy, termini, DPA, subprocessors e retention.
2. Definire supporto, priorità, escalation e SLA.
3. Configurare monitoring, alerting, backup e incident response.
4. Creare casi cliente soltanto da dati reali e autorizzati.
5. Impostare `VITE_STRIPE_LIVE_VERIFIED=true` solo dopo test live controllato.
6. Impostare `VITE_E2E_VERIFIED=true` solo dopo suite end-to-end superata.
7. Impostare `VITE_PRODUCTION_READINESS_APPROVED=true` soltanto con approvazione esplicita finale.

## Ordine di distribuzione raccomandato

1. Congelare listino e naming.
2. Creare ambiente Supabase preview o branch di sviluppo.
3. Riconciliare migrazioni e rigenerare tipi.
4. Configurare secret preview.
5. Distribuire Edge Functions preview.
6. Creare progetto Vercel preview dal branch.
7. Configurare URL callback/provider sul dominio preview.
8. Eseguire test tecnici e funzionali.
9. Correggere e ripetere.
10. Approvare merge e produzione separatamente.

## Rollback

- non unire la PR finché i blocchi P0 non sono chiusi;
- mantenere i cron disabilitati finché i worker non sono distribuiti e testati;
- mantenere TTS preview disabilitato;
- mantenere i tre flag readiness a `false`;
- in caso di errore provider, disabilitare il relativo canale a livello tenant prima di intervenire sui dati;
- non ripristinare file `.env`, token in URL o segreti nelle tabelle tenant-readable.
