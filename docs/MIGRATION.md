# Migrazione Lovable → GitHub → Vercel

## Origine verificata

- Lovable workspace: `Alessandro caruso`
- progetto: `assistant-call-sync`
- prodotto descritto: `ClerkAI`
- backend: Supabase project `weufeilkdzimmmgskobs`
- repository di destinazione: `AleCaru02/klark.ai`
- branch di lavoro: `agent/clerkai-audit-migration`

## Stato

Il repository è stato inizializzato, ma l'esportazione completa del codebase Lovable non è ancora presente. Il collegamento Git ufficiale di Lovable crea un nuovo repository e non può importare o collegare un repository GitHub preesistente.

## Ordine corretto

1. Esportare il codebase completo dalla modalità Code di Lovable oppure attivare la sincronizzazione Git su un nuovo repository.
2. Trasferire il contenuto nel presente repository senza `.env` e senza segreti.
3. Eseguire lint, test, build, audit dipendenze e test end-to-end.
4. Applicare le migrazioni SQL solo dopo revisione.
5. Collegare questo repository a un nuovo progetto Vercel.
6. Configurare variabili Vercel e URL OAuth/webhook per preview e production.
7. Eseguire smoke test su tutte le rotte pubbliche, utente e admin.
