# Sicurezza

Non aprire issue pubbliche contenenti token, chiavi API, credenziali, dati personali o registrazioni.

## Regole minime

- I token OAuth Google, Meta e WhatsApp non devono essere leggibili dal browser.
- Le chiavi Stripe, Twilio, ElevenLabs e Supabase service role devono esistere solo nei secret store server-side.
- Ogni endpoint amministrativo deve verificare il ruolo sul server, non soltanto nel frontend.
- Le migrazioni SQL di sicurezza vengono revisionate e applicate separatamente dalla build frontend.
