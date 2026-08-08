# ClerkAI — working name

SaaS multi-tenant per gestione di chiamate, appuntamenti, WhatsApp, CRM e follow-up.

> **Stato:** pre-produzione. Il repository contiene un prodotto ampio e una fase avanzata di hardening, ma non deve essere considerato pronto al go-live finché backend, provider, dominio, billing e test end-to-end non sono completati.

## Repository corretto

Questo è il repository operativo sincronizzato con il progetto Lovable `assistant-call-sync`.

Il repository separato `AleCaru02/klark.ai` non contiene l'applicazione e non deve essere usato come sorgente di deployment.

## Naming

`ClerkAI` è un working name storico. Le varianti Clark, Klark e Clerk AI presentano collisioni con prodotti esistenti. Consultare:

- `docs/BRAND-NAMING-RISK-2026-08-05.md`

Non modificare dominio, canonical, email o provider OAuth prima della scelta definitiva del brand.

## Funzioni previste

- chiamate inbound e outbound con numero dedicato;
- prenotazione, spostamento e cancellazione appuntamenti;
- Google Calendar e link Meet;
- conferme e promemoria WhatsApp;
- CRM, pipeline e follow-up;
- import Meta Lead Ads;
- log, riepiloghi, consumi e Test Center;
- registrazione e trascrizione soltanto quando abilitate e configurate correttamente;
- isolamento multi-tenant e amministrazione di piattaforma separata dai ruoli dei clienti.

## Stack reale

- Frontend: Vite, React, TypeScript, Tailwind e shadcn/ui;
- Backend: Supabase Postgres, Auth ed Edge Functions;
- Voice: Twilio Voice;
- sintesi vocale: ElevenLabs, disabilitata di default per la demo pubblica;
- messaggistica: WhatsApp Business Platform Cloud API;
- calendario: Google Calendar API;
- pagamenti previsti: Stripe subscription trimestrale e usage-based billing.

## Listino centralizzato

Prezzi e consumi pubblici sono definiti soltanto in:

- `src/config/plans.ts`

Identità, email, dominio e durata minima sono definiti in:

- `src/config/product.ts`

Non duplicare listini o contatti all'interno delle pagine.

## Qualità e sicurezza

La pull request di hardening esegue:

- typecheck TypeScript;
- test unitari e test di integrità commerciale;
- build di produzione;
- test crittografici per webhook;
- `deno check` delle Edge Functions modificate;
- scansione dei file ambiente e dei dati segnaposto;
- controllo contro il ritorno di prezzi divergenti, clienti inventati e claim non dimostrabili.

Documenti principali:

- `docs/SECURITY-HARDENING-2026-08-05.md`
- `docs/BACKEND-AUDIT-2026-08-05.md`
- `docs/COMPETITOR-BENCHMARK-2026-08-05.md`
- `docs/BRAND-NAMING-RISK-2026-08-05.md`
- `docs/RELEASE-READINESS-CHECKLIST.md`

## Blocchi di produzione

1. Ottenere accesso verificato al progetto Supabase indicato in `supabase/config.toml` oppure migrare il backend a un progetto posseduto.
2. Riconciliare la migration history senza rieseguire alla cieca modifiche già applicate.
3. Configurare e ruotare tutti i secret provider.
4. Distribuire le Edge Functions in un ambiente preview.
5. Verificare Twilio, WhatsApp, Google, Meta, ElevenLabs e Stripe.
6. Eseguire test end-to-end positivi e negativi, inclusi isolamento tenant e idempotenza.
7. Definire nome, dominio, email e identità legale definitivi.
8. Completare privacy, termini, DPA, retention, supporto e SLA.
9. Importare il repository in Vercel e creare un deployment preview.
10. Eseguire smoke test e approvazione esplicita prima del merge in `main`.

## Sviluppo locale

Requisiti: Node.js 22 e npm.

```bash
git clone https://github.com/AleCaru02/assistant-call-sync.git
cd assistant-call-sync
npm install
npm run test
npm run build
npm run dev
```

Le modifiche applicative devono essere fatte su GitHub tramite branch e pull request. Lovable resta sincronizzato, ma non è necessario utilizzare crediti Lovable per intervenire sul codice.
