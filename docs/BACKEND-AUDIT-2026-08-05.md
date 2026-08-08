# Audit backend Supabase

Data verifica: 5 agosto 2026

Metodo: query in sola lettura sul database collegato al progetto Lovable `assistant-call-sync`. Nessun nominativo, contenuto di chiamate o dato cliente è stato letto.

## Stato generale

- database abilitato e raggiungibile tramite Lovable;
- PostgreSQL 17.6;
- 51 tabelle nello schema `public`;
- 51 tabelle con Row Level Security attiva;
- nessuna tabella pubblica senza RLS;
- 0 cron job attivi;
- 1 platform admin;
- bucket `tenant-knowledge` privato;
- bucket `voice-audio` privato.

## Dati operativi

Il database è in stato pre-lancio:

- tenant: 1;
- membership: 1;
- sottoscrizioni attive: 0;
- numeri telefonici assegnati: 0;
- connessioni Google: 0;
- connessioni WhatsApp: 0;
- connessioni Facebook: 0;
- chiamate: 0;
- appuntamenti: 0;
- messaggi WhatsApp: 0;
- contatti: 0.

Questo conferma che non esistono ancora metriche reali di utilizzo o casi cliente da pubblicare.

## Tabelle server-only

Le seguenti tabelle non concedono SELECT o scrittura ad `anon` o `authenticated`:

- `platform_admins`;
- `tenant_secrets`;
- `oauth_states`;
- `provider_events`;
- `google_watch_channels`.

## Funzioni privilegiate

Le funzioni `SECURITY DEFINER` controllate:

- impostano `search_path=public`;
- i worker e le funzioni amministrative non sono eseguibili da `anon` o `authenticated`;
- le funzioni tenant-scoped sono disponibili agli utenti autenticati e derivano l'accesso dal database;
- `lookup_referral_code` è disponibile pubblicamente, valida formato e lunghezza e restituisce soltanto un booleano di esistenza del codice.

## Policy RLS

Le policy tenant utilizzano prevalentemente:

- `user_belongs_to_tenant(auth.uid(), tenant_id)`;
- `user_has_profile_in_tenant(auth.uid(), tenant_id)`;
- `has_membership_role(auth.uid(), 'admin')`.

Molte policy sono dichiarate al ruolo SQL `public` invece di `authenticated`. L'espressione con `auth.uid()` impedisce l'accesso anonimo ai dati tenant, ma una futura migrazione dovrebbe restringere esplicitamente i ruoli per ridurre ambiguità e superficie di configurazione.

## Colonne sensibili

Token Google, Facebook e WhatsApp si trovano in tabelle senza privilegi browser.

La tabella tenant-readable `settings` conserva ancora la colonna legacy `facebook_webhook_secret`. Alla verifica:

- valori non vuoti in `settings`: 0;
- valori non vuoti in `tenant_secrets`: 0.

Non risulta quindi un segreto attivo esposto. La colonna legacy deve essere eliminata durante la riconciliazione delle migrazioni, dopo aver verificato tutti i riferimenti e rigenerato i tipi Supabase.

## Migration history

La cronologia registrata nel database contiene soltanto poche versioni recenti rispetto al numero di file presenti nel repository. Non eseguire un push massivo delle migrazioni senza riconciliazione: alcune modifiche risultano già applicate direttamente e potrebbero fallire o duplicarsi.

## Listino database

Valori rilevati:

| Piano | Mensile DB | Trimestrale DB | Minuti DB | Overage voce DB |
|---|---:|---:|---:|---:|
| Voice Agenda | 149 € | 447 € | 200 | 0,25 €/min |
| Voice Agenda + WhatsApp | 249 € | 747 € | 400 | 0,20 €/min |
| Full | 399 € | 1.197 € | 800 | 0,15 €/min |

Specifiche storiche presenti nel progetto:

| Piano | Mensile specifica | Trimestrale | Minuti specifica | Overage voce |
|---|---:|---:|---:|---:|
| Voice Agenda | 149 € | 447 € | 200 | 0,45 €/min |
| Voice Agenda + WhatsApp | 229 € | 687 € | 200 | 0,45 €/min |
| Full | 399 € | 1.197 € | 900 | 0,45 €/min |

Il billing resta bloccato finché non viene approvato un listino definitivo e allineato tra:

- `src/config/plans.ts`;
- tabella `plans`;
- prodotti e prezzi Stripe;
- meters e overage;
- contratto e documenti commerciali;
- dashboard consumi.

## Conclusione

La struttura di isolamento è molto più solida rispetto allo stato iniziale, ma il backend non è pronto alla produzione perché mancano provider, billing, deployment verificato, collaudo end-to-end, riconciliazione migrazioni e decisione listino.
