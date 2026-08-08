# Benchmark concorrenti — segreterie e receptionist AI

Data analisi: 5 agosto 2026

## Obiettivo

Confrontare il progetto con operatori attuali del mercato, evitando di copiare promesse non dimostrabili e identificando gli elementi che rendono credibile un servizio di segreteria AI.

## Operatori osservati

### Clark — sayclark.com

- receptionist vocale per attività di servizio;
- numero dedicato e inoltro chiamate;
- riepiloghi dopo la chiamata;
- Google Calendar;
- onboarding molto rapido e prova gratuita;
- forte verticalizzazione per categorie professionali.

**Lezione:** il valore commerciale viene spiegato come percorso completo dalla chiamata alla prenotazione, non come semplice voce AI.

### Clerk AI — clerk.ai

- voce, SMS, RCS e WhatsApp;
- orchestrazione multicanale dopo la chiamata;
- CRM e API;
- prezzo a crediti e controllo della concorrenza chiamate;
- posizionamento enterprise e compliance.

**Lezione:** il mercato più maturo vende continuità del contesto tra canali, integrazioni e azioni successive.

### Klark — klark.ai

- automazione e copilota per customer service;
- collegamento a helpdesk e CRM;
- apprendimento da ticket, documenti e knowledge base;
- passaggio a un operatore umano quando manca certezza;
- dashboard di performance e pricing collegato agli esiti.

**Lezione:** l'handoff umano e l'uso controllato della knowledge base sono elementi centrali per affidabilità e adozione.

### Operatori italiani osservati

Le offerte italiane analizzate tendono a evidenziare:

- risposta telefonica continuativa;
- agenda e calendario;
- WhatsApp;
- configurazione guidata;
- piani mensili o a consumo;
- verticalizzazione per studi e attività locali.

Il livello di dettaglio su sicurezza, consenso, tenant isolation, error handling e collaudo è spesso inferiore al dettaglio commerciale.

## Elementi che il progetto deve mantenere

1. **Azione dopo la chiamata**: appuntamento, riepilogo, messaggio, stato del contatto e prossima attività.
2. **Regole specifiche**: disponibilità, durata, buffer, preavviso, eccezioni e priorità.
3. **Handoff umano**: l'AI deve fermarsi e inoltrare quando non può agire correttamente.
4. **Test Center**: ogni integrazione e scenario critico deve essere verificato prima del live.
5. **Consumi trasparenti**: minuti connessi, messaggi, extra e soglie visibili.
6. **Onboarding assistito**: evitare la promessa generica di attivazione immediata.
7. **Prove reali**: niente clienti, recensioni, rating o risultati non documentati.
8. **Multi-tenant verificabile**: accessi e dati separati tra clienti.

## Posizionamento raccomandato

> Una segreteria AI configurata sul processo reale dell'attività, che trasforma le chiamate in azioni tracciabili e passa a una persona quando serve.

Il progetto non deve competere soltanto sulla voce naturale o sul prezzo. Il vantaggio difendibile è la combinazione di:

- onboarding strutturato;
- controllo delle azioni;
- integrazione voce–agenda–WhatsApp–CRM;
- log ed eccezioni;
- trasparenza su costi, limiti e stato delle integrazioni.

## Gap rispetto ai concorrenti pronti alla vendita

- backend produttivo non ancora sotto accesso verificato;
- nessun deployment Vercel collegato;
- provider voce, WhatsApp, calendario e pagamento non collaudati end-to-end;
- billing Stripe non attivo;
- dominio e naming non approvati;
- documentazione legale ancora pre-lancio;
- assenza di casi cliente reali e misurati;
- supporto e SLA non ancora formalizzati;
- monitoring produttivo e procedure di incidente da completare.

## Regole commerciali

Non pubblicare:

- percentuali di miglioramento non misurate;
- numero di clienti o chiamate non verificato;
- tempi di attivazione garantiti senza dati operativi;
- dichiarazioni assolute di conformità o sicurezza;
- testimonianze costruite;
- uptime garantito senza infrastruttura e SLA attivi.
