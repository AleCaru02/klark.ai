# Piano di correzione

## Fase 1 — bloccare i rischi immediati

1. Disattivare checkout finto e CTA di pagamento.
2. Rendere `voice-audio` privato e revocare policy pubbliche.
3. Rimuovere SELECT client dalle tabelle token e da settings sensibili.
4. Ruotare token OAuth/API che possono essere passati da browser o log.
5. Disabilitare i cron 401 fino alla nuova autenticazione sicura.
6. Rendere Stripe fail-closed e idempotente.

## Fase 2 — autorizzazione multi-tenant

1. Creare un helper server-side unico che valida JWT, user ID, membership e tenant.
2. Applicarlo a ogni Edge Function invocabile dal browser.
3. Separare endpoint pubblici provider da endpoint utente.
4. Firmare OAuth state con nonce, scadenza e record monouso.
5. Verificare firme Meta, WhatsApp e Twilio senza fallback permissivo.

## Fase 3 — correggere automazioni

1. Worker cron autenticati tramite secret/Vault, non chiavi nel comando SQL.
2. Claim atomico delle righe con `FOR UPDATE SKIP LOCKED` o RPC dedicata.
3. Idempotency key per Stripe, WhatsApp, Meta lead e appuntamenti.
4. Controllo disponibilità Google + DB prima della creazione.
5. Compensazione: eliminare evento esterno se la scrittura DB fallisce.
6. Implementare davvero conferma, spostamento e cancellazione WhatsApp.

## Fase 4 — privacy e AI

1. Registrazione chiamate disattiva per default e subordinata a opt-in verificato.
2. Audio privato con signed URL breve.
3. Retention che elimina anche gli oggetti Storage e le copie provider.
4. Minimizzazione PII inviata all'AI e consenso/documentazione dei sub-responsabili.
5. Sostituire `ai.gateway.lovable.dev` con provider gestito via Vercel AI Gateway o API diretta se si vogliono eliminare crediti Lovable.

## Fase 5 — GitHub e Vercel

1. Importare il codebase completo nel repository.
2. Correggere lint/typecheck/test/build.
3. Aggiungere Playwright per flussi critici.
4. Collegare GitHub a un nuovo progetto Vercel.
5. Configurare preview e production con URL OAuth distinti.
6. Pubblicare prima una preview protetta, poi production dopo test P0/P1.