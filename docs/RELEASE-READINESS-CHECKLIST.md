# Release readiness checklist

Questa checklist deve essere completata prima di rendere la pull request pronta per il merge.

## Identità e commerciale

- [ ] Nome definitivo approvato dopo verifica domini e marchi.
- [ ] Dominio, email e identità legale definitivi.
- [ ] Listino unico approvato tra frontend, database, Stripe e contratto.
- [ ] IVA, rinnovo, recesso, rimborsi e overage formalizzati.
- [ ] Nessun claim commerciale privo di prova.

## Supabase

- [ ] Ambiente preview o branch disponibile.
- [ ] Migration history riconciliata.
- [ ] Tipi TypeScript rigenerati.
- [ ] Colonna legacy `settings.facebook_webhook_secret` rimossa.
- [ ] Policy migrate a ruoli espliciti dove opportuno.
- [ ] Advisor sicurezza e performance verificati.
- [ ] Backup e rollback provati.

## Provider

- [ ] Twilio account, numero, firme e callback verificati.
- [ ] Google OAuth, Calendar e watch verificati.
- [ ] WhatsApp Business, template, webhook e costi verificati.
- [ ] Meta Lead Ads OAuth e webhook verificati.
- [ ] Stripe prodotti, prezzi, meters, webhook e pagamenti verificati.
- [ ] Resend mittente e consegna credenziali verificati.
- [ ] ElevenLabs disabilitato oppure configurato con limiti e budget.

## Test

- [ ] CI GitHub verde sul commit finale.
- [ ] Test firme valide e non valide.
- [ ] Test replay e idempotenza.
- [ ] Test isolamento tra almeno due tenant.
- [ ] Test chiamata inbound e outbound.
- [ ] Test prenotazione, spostamento e cancellazione.
- [ ] Test indisponibilità e conflitto calendario.
- [ ] Test WhatsApp conferma, annullamento, stop e callback.
- [ ] Test errori provider e compensazioni.
- [ ] Test consumi, soglie e overage.
- [ ] Test responsive, accessibilità e browser principali.

## Vercel

- [ ] Progetto preview importato dal repository corretto.
- [ ] Variabili frontend configurate senza segreti server.
- [ ] Routing SPA e deep link verificati.
- [ ] Header di sicurezza verificati.
- [ ] Login, reset password e route private noindex.
- [ ] Callback OAuth aggiornate al dominio preview.
- [ ] Smoke test preview completato.

## Legale e operazioni

- [ ] Privacy definitiva approvata.
- [ ] Termini definitivi approvati.
- [ ] DPA e subprocessors pubblicati.
- [ ] Registrazione e trascrizione configurate con informativa e base giuridica.
- [ ] Retention e cancellazione dati verificate.
- [ ] Supporto, priorità, escalation e SLA definiti.
- [ ] Monitoring e incident response attivi.

## Approvazione finale

- [ ] `VITE_STRIPE_LIVE_VERIFIED=true` soltanto dopo verifica live.
- [ ] `VITE_E2E_VERIFIED=true` soltanto dopo test completi.
- [ ] `VITE_PRODUCTION_READINESS_APPROVED=true` soltanto dopo approvazione esplicita.
- [ ] PR tolta dalla modalità draft.
- [ ] Merge approvato.
- [ ] Produzione approvata separatamente dal merge.
