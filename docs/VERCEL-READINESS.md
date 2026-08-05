# Vercel readiness

## Già predisposto

- framework Vite;
- output `dist`;
- rewrite SPA;
- header `nosniff`, frame deny, referrer e permissions policy;
- cache immutabile per asset hashati.

## Mancante prima del primo deploy

- codebase completo e lockfile;
- variabili pubbliche Supabase;
- secret solo server-side;
- `APP_URL` Vercel per production;
- redirect URL Google/Meta/WhatsApp aggiornati;
- CSP calibrata dopo inventario domini;
- test di tutte le rotte dirette;
- preview protetta;
- nessun dominio production finché checkout e P0 non sono corretti.

## Nota architetturale

Le Edge Function e il database rimangono su Supabase. Vercel ospita il frontend; spostare il frontend non corregge automaticamente RLS, webhook, cron, token e AI gateway.