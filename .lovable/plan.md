# Verifica Twilio read-only — stato e opzioni

## Esito immediato: non posso interrogare l'API Twilio adesso

Verificato in questo turno:

- Non esiste alcuna connessione Twilio nel workspace (connettori disponibili: solo Google Search Console x2 e Firecrawl). Quindi il gateway connettori non è utilizzabile per chiamare l'API Twilio.
- `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN` esistono solo come secret runtime del backend: sono leggibili unicamente da dentro una Edge Function tramite `Deno.env.get()`. Nessuno strumento mi restituisce i valori, e non devo mostrarli.
- Nessuna Edge Function esistente espone una verifica account Twilio: `twilio-make-call` effettua chiamate reali, `twilio-voice-webhook` / `twilio-voice-gather` / `twilio-call-status` sono webhook. Nessuna di queste può rispondere ai punti 1-5 senza generare traffico o modifiche.

Conclusione onesta: **non configurato per interrogazione diretta**. Nessuna verifica è stata simulata, nessuna modifica effettuata.

## Opzioni per ottenere la verifica (scegline una)

### Opzione A — Funzione diagnostica temporanea (richiede una modifica)
Creare una Edge Function `twilio-account-check`, protetta (solo admin autenticato), che esegue solo GET read-only:

- `GET /2010-04-01/Accounts/{Sid}.json` → autenticazione (401/200), `type` (Trial/Full), `status`
- `GET /2010-04-01/Accounts/{Sid}/IncomingPhoneNumbers.json` → numeri posseduti: `phone_number`, `friendly_name`, `sid`, `capabilities.voice/sms`, prefisso paese
- `GET /2010-04-01/Accounts/{Sid}/Accounts.json` → subaccount e relativi `status`
- Derivazione punto 4: numeri che iniziano con `+39` e con `capabilities.voice = true`
- Derivazione punto 5: `type = Trial` oppure `status != active` → limitazioni alle chiamate reali

Nessuna POST, nessun acquisto, nessuna chiamata. Il risultato viene riportato in chat senza mai includere l'Auth Token.
Costo: viola il vincolo attuale "nessuna modifica al codice" (aggiunge un file e un deploy). Rimovibile subito dopo la verifica.

### Opzione B — Connessione Twilio via connettore
Creare una connessione Twilio nelle impostazioni connettori del workspace. Da lì posso eseguire chiamate read-only al gateway senza toccare il codice del progetto. Richiede che tu configuri la connessione (API Key SID + Secret).

### Opzione C — Verifica manuale lato tuo
Esegui in locale, con le tue credenziali:

```text
curl -s -u "$SID:$TOKEN" https://api.twilio.com/2010-04-01/Accounts/$SID.json
curl -s -u "$SID:$TOKEN" https://api.twilio.com/2010-04-01/Accounts/$SID/IncomingPhoneNumbers.json
curl -s -u "$SID:$TOKEN" https://api.twilio.com/2010-04-01/Accounts/$SID/Accounts.json
```

Incollami gli output (senza token) e ti produco la sintesi sui 5 punti richiesti.

## Nessuna modifica finché non scegli
Nessun file, database, secret o deploy è stato toccato in questo turno.
