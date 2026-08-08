# Rischio naming e dominio

Data verifica: 5 agosto 2026

## Stato attuale

- Il proprietario del progetto lo identifica come **Clark / clark.ai**.
- Il codice operativo usa il nome **ClerkAI**.
- Il progetto Lovable e il repository operativo si chiamano **assistant-call-sync**.
- Esiste un repository separato **klark.ai**, ma contiene soltanto un README e non è l'applicazione.
- Il codice dichiara come URL pubblico `https://www.clerkai.it`, ma il dominio e la sua titolarità non risultano configurati nel progetto Vercel collegato.

## Collisioni rilevate online

### Clark

Esiste già una receptionist AI denominata **Clark**, direttamente concorrente, che gestisce chiamate, riepiloghi e prenotazioni su Google Calendar. Il dominio `clark.ai` non risulta disponibile.

### Klark

Esiste già **Klark.ai**, società AI per customer service e automazione di ticket. Esiste inoltre Klark.app, che dichiara pubblicamente la frequente confusione tra i due marchi. Il dominio `klark.ai` non risulta disponibile.

### ClerkAI / Clerk AI

Esiste già **Clerk AI** su `clerk.ai`, piattaforma di agenti vocali e messaggistica multicanale, quindi molto vicina al prodotto. Esiste anche `clerkai.eu`, prodotto distinto dedicato alla contabilità.

## Valutazione

Nessuna delle tre varianti considerate — Clark, Klark o ClerkAI — può essere trattata come scelta sicura soltanto perché piace o perché un dominio nazionale sembra libero.

La disponibilità tecnica di un dominio non equivale a disponibilità del marchio, assenza di confusione o libertà di utilizzo commerciale.

## Decisione tecnica adottata

- Non viene eseguito un rebrand automatico.
- Il codice mantiene temporaneamente il nome storico **ClerkAI** esclusivamente come working name.
- Nessun nuovo dominio viene acquistato o collegato.
- Nessun deployment pubblico Vercel viene promosso come produzione.
- Tutti i riferimenti a società, partita IVA, sede, numero di telefono e profili social non verificati sono stati rimossi.

## Passaggi richiesti prima del go-live

1. Definire 3–5 nomi alternativi realmente distintivi.
2. Verificare domini principali e varianti difensive.
3. Eseguire ricerca marchi almeno su EUIPO, UIBM e classi pertinenti.
4. Verificare società, app store, social e risultati di ricerca.
5. Valutare il rischio di confusione con prodotti AI, telefonia, CRM e assistenza clienti.
6. Scegliere il nome definitivo e documentare la decisione.
7. Aggiornare in un'unica modifica:
   - configurazione prodotto;
   - dominio e canonical;
   - email;
   - asset e favicon;
   - metadata e manifest;
   - documenti legali;
   - provider OAuth e webhook;
   - Stripe e comunicazioni cliente.

## Nota sul repository `klark.ai`

Non deve essere usato come sorgente di produzione: non contiene il codice applicativo. Il repository operativo resta `AleCaru02/assistant-call-sync` finché non viene pianificata una migrazione Git completa e verificata.
