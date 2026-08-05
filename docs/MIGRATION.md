# Migrazione Lovable → GitHub → Vercel

## Origine verificata

- Lovable workspace: `Alessandro caruso`
- progetto: `assistant-call-sync`
- prodotto: `ClerkAI`
- backend: Supabase project `weufeilkdzimmmgskobs`
- repository di destinazione: `AleCaru02/klark.ai`
- branch di lavoro: `agent/clerkai-audit-migration`

## Percorso corretto

Lovable non collega questo progetto a un repository GitHub già esistente: la connessione GitHub crea un nuovo repository sorgente. Il percorso previsto è quindi:

1. collegare il progetto Lovable a GitHub;
2. lasciare che Lovable crei e sincronizzi il nuovo repository;
3. importare quel repository nel branch `agent/clerkai-audit-migration` di `AleCaru02/klark.ai`;
4. conservare le migrazioni di hardening già applicate e versionate;
5. installare dipendenze ed eseguire lint, typecheck, test e build;
6. completare Edge Functions, webhook, OAuth, worker, booking, WhatsApp e Stripe;
7. collegare `klark.ai` a Vercel solo dopo il superamento dei controlli.

## Import sicuro

Dopo aver clonato il repository creato da Lovable, usare:

```bash
bash scripts/import-lovable-source.sh /percorso/repo-lovable .
```

Lo script esclude `.env`, metadati Git, dipendenze generate e le migrazioni di hardening del 5 agosto 2026 già presenti nel repository target.

## Divieti fino alla verifica finale

- Non unire la PR draft.
- Non creare un deployment Production Vercel.
- Non riattivare i cron con una chiave anon.
- Non inserire service role, OAuth secret o webhook secret in file versionati o variabili `VITE_*`.
- Non dichiarare funzionanti integrazioni non testate con credenziali reali.
