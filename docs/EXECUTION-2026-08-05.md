# Esecuzione ClerkAI — 5 agosto 2026

## Stato

Le modifiche sono sulla preview Lovable e sul database collegato. La produzione Lovable non è stata ripubblicata. La PR GitHub resta draft e non deve essere unita finché il sorgente completo non è esportato.

## Fase 1 completata in Lovable

Commit Lovable: `1be2247a5741b784f5d8c98d0ef4914a47cbbead`.

- token Google, Meta e WhatsApp non più leggibili dal browser;
- RPC `get_integration_status()` senza segreti;
- frontend aggiornato per usare lo stato sicuro;
- bucket `voice-audio` privato;
- audio TTS tramite signed URL;
- endpoint `ai-book-appointment` limitato alle chiamate interne service-role e controllo contact/tenant;
- input carta rimossi dal checkout; stato esplicito pagamento non configurato;
- typecheck e build passati; suite test esistente 1/1 passata;
- nessuna pubblicazione.

## Hardening database applicato direttamente

- rimossi i due cron che generavano 401 ogni minuto con anon key incorporata;
- aggiunte tabelle server-only `oauth_states`, `provider_events`, `google_watch_channels` e `tenant_secrets`;
- aggiunti claim atomici con `FOR UPDATE SKIP LOCKED` per coda chiamate e promemoria;
- aggiunti lock, worker ID, tentativi ed error code sanificati;
- aggiunti vincoli e indici di idempotenza per Twilio, WhatsApp, referral, appuntamenti, reminder e coda;
- chiusa enumerazione anonima referral; introdotta RPC puntuale;
- rimossa lettura autenticata degli audit log globali `tenant_id IS NULL`;
- spostato `facebook_webhook_secret` fuori da `settings` e bloccate scritture client dei segreti;
- tutte le policy `UPDATE` hanno ora `WITH CHECK`, impedendo lo spostamento di righe verso altri tenant;
- gli helper `SECURITY DEFINER` non accettano più interrogazioni su user ID arbitrari;
- `fix_contacts_without_stage()` è ora service-role-only;
- aggiunti default privacy: timezone, AI data processing opt-in e allowed origins.

Verifiche database:

- cron attivi dopo la rimozione: `0`;
- RLS attiva sulle nuove tabelle: `true`;
- policy anon referral rimasta: `0`;
- policy audit globale autenticati rimasta: `0`;
- policy UPDATE senza `WITH CHECK`: `0`;
- `facebook_webhook_secret` non nullo in settings: `0`;
- execute anon su helper tenant e riparazione globale: `false`.

## Blocco operativo

Dopo la Fase 1 il workspace Lovable ha esaurito i crediti. L'agente Lovable rifiuta ulteriori modifiche al sorgente. Il database e GitHub restano accessibili, ma le Edge Functions nel progetto Lovable non possono essere riscritte dal connettore senza crediti.

Per continuare senza dipendere dai crediti serve esportare il codebase ZIP da Lovable Code Mode oppure collegare il progetto a un nuovo repository GitHub creato da Lovable. Il repository `AleCaru02/klark.ai` preesistente non può essere collegato direttamente dall'integrazione Lovable.

## Non ancora completato

- firme obbligatorie per tutti i webhook Meta, WhatsApp, Twilio e Stripe;
- authz multi-tenant uniforme su tutte le Edge Functions;
- OAuth state monouso nei callback (schema pronto, codice da aggiornare);
- worker aggiornati per usare le nuove RPC e cron sicuri ricreati;
- booking transazionale e controllo free/busy;
- WhatsApp reale per tenant e flusso SPOSTA completo;
- Stripe Checkout/Billing Portal;
- test center senza simulazioni;
- esportazione completa del sorgente, deploy Vercel e test end-to-end.
