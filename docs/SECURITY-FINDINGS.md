# Security findings

## P0 — correzione prima di qualsiasi deploy pubblico

| ID | Area | Problema | Impatto |
|---|---|---|---|
| P0-01 | RLS | token Google/Meta/WhatsApp leggibili dal client | furto account e integrazioni |
| P0-02 | OAuth | state non firmato e callback non vincolati alla sessione | account/tenant binding manomesso |
| P0-03 | Webhook | firme Meta e WhatsApp non verificate | mutazioni DB da richieste falsificate |
| P0-04 | Edge auth | funzioni service-role senza tenant authorization | accesso e azioni cross-tenant |
| P0-05 | Stripe | webhook fail-open senza secret | creazione subscription/tenant falsi |
| P0-06 | Storage | audio pubblico e policy storage errate | esposizione dati vocali e personali |
| P0-07 | Cron | worker chiamati con token errato, 401 ogni minuto | automazioni ferme |
| P0-08 | Checkout | modulo carta finto/non Stripe | rischio reputazionale e raccolta impropria |
| P0-09 | Recording | registrazione Twilio sempre attiva | violazione consenso e privacy |
| P0-10 | Logging | OAuth code, state e token nei log | fuga credenziali |

## P1 — affidabilità e integrità

- idempotenza Stripe, webhook e code;
- lock atomico per call queue e reminders;
- controllo conflitti calendario;
- timezone esplicito Europe/Rome;
- cancellazione e spostamento coerenti tra DB, Google e Zoom;
- conferme WhatsApp realmente inviate e non simulate;
- transazioni per provisioning account;
- eliminazione fisica audio durante retention;
- schema validation degli output AI;
- rate limit e limiti piano su chiamate/messaggi;
- controllo `do_not_contact` prima di ogni invio/chiamata;
- sostituzione del gateway AI Lovable se l'obiettivo è azzerare i crediti Lovable.

## Regola di rilascio

Nessun deploy production finché tutti i P0 non hanno test automatico e prova negativa: utente di tenant A non può leggere o modificare tenant B.