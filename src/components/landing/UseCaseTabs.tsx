import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Headphones,
  Hotel,
  House,
  Scale,
  Scissors,
  ShoppingBag,
  Stethoscope,
  UserRoundCheck,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const useCases = {
  ecommerce: {
    label: "Ecommerce",
    icon: ShoppingBag,
    problem: "Ordini, spedizioni e resi generano richieste ripetitive ogni giorno.",
    capability: "Stato ordine e assistenza pre/post vendita",
    customer: "Ciao, il mio ordine #4582 doveva arrivare ieri. Mi dici dove si trova?",
    assistant:
      "Certo. Controllo lo stato dell'ordine nel sistema collegato. Risulta affidato al corriere e in consegna oggi. Se vuoi, posso anche inviarti il riferimento della spedizione.",
    result: "Richiesta gestita senza impegnare un operatore. Le eccezioni possono essere aperte al team.",
  },
  hospitality: {
    label: "Hotel e strutture ricettive",
    icon: Hotel,
    problem: "Gli ospiti chiamano per check-in, servizi e informazioni anche fuori reception.",
    capability: "Informazioni ospite e richieste operative",
    customer: "Arriveremo verso le 23:30. Possiamo fare il check-in a quell'ora?",
    assistant:
      "Sì, per questa struttura è previsto l'arrivo tardivo. Ti spiego la procedura configurata e, se serve, raccolgo i dati necessari per avvisare la reception.",
    result: "L'ospite riceve una risposta coerente con le regole della struttura, senza inventare disponibilità o servizi.",
  },
  qualification: {
    label: "Qualifica Lead",
    icon: UserRoundCheck,
    problem: "Molti contatti arrivano senza le informazioni necessarie per capire priorità e interesse reale.",
    capability: "Raccolta requisiti e instradamento commerciale",
    customer: "Vorrei capire se il vostro servizio può andare bene per la mia azienda.",
    assistant:
      "Certo. Per indirizzarti correttamente ti faccio alcune domande rapide: che tipo di attività gestisci, quante richieste ricevi e qual è il risultato che vuoi ottenere?",
    result: "Il commerciale riceve un lead già strutturato con bisogno, contesto e prossima azione.",
  },
  healthcare: {
    label: "Studi Medici",
    icon: Stethoscope,
    problem: "Agenda e richieste amministrative si mescolano a temi che devono restare al personale sanitario.",
    capability: "Agenda e informazioni amministrative",
    customer: "Vorrei spostare la visita di martedì. Avete qualcosa giovedì pomeriggio?",
    assistant:
      "Posso verificare le disponibilità previste per giovedì e proporti gli orari consentiti. Per richieste cliniche o valutazioni mediche, invece, coinvolgo il personale dello studio.",
    result: "La parte amministrativa viene gestita; nessuna diagnosi o indicazione clinica viene improvvisata.",
  },
  legal: {
    label: "Studi Legali",
    icon: Scale,
    problem: "Le prime chiamate richiedono tempo anche quando serve solo capire il motivo del contatto.",
    capability: "Prima raccolta e smistamento della richiesta",
    customer: "Avrei bisogno di parlare con un avvocato per una questione di lavoro abbastanza urgente.",
    assistant:
      "Posso raccogliere le informazioni iniziali per il professionista: nome, recapito, tipo di questione e l'eventuale scadenza. Non fornisco pareri legali, ma preparo la richiesta per il referente corretto.",
    result: "Lo studio riceve una richiesta ordinata senza delegare all'AI valutazioni professionali.",
  },
  realestate: {
    label: "Agenzie Immobiliari",
    icon: House,
    problem: "I lead chiamano mentre gli agenti sono in visita, in auto o con altri clienti.",
    capability: "Qualifica richiesta e appuntamento visita",
    customer: "Ho visto il trilocale in Via Verdi. È ancora disponibile? Vorrei visitarlo sabato.",
    assistant:
      "Verifico le informazioni disponibili sull'immobile e raccolgo le tue preferenze. Se l'agenda è collegata, posso proporti gli slot consentiti per la visita di sabato.",
    result: "Il lead arriva all'agente con immobile, esigenza, recapito e disponibilità già raccolti.",
  },
  restaurant: {
    label: "Ristoranti",
    icon: UtensilsCrossed,
    problem: "Il telefono squilla proprio quando sala e cucina sono più impegnate.",
    capability: "Prenotazioni e informazioni ricorrenti",
    customer: "Vorrei prenotare un tavolo per quattro domani alle 20:30. Avete posto?",
    assistant:
      "Controllo le disponibilità previste per domani. Se le 20:30 sono disponibili posso raccogliere nome e recapito e completare la prenotazione secondo le regole del locale.",
    result: "La richiesta viene gestita mentre il personale continua a lavorare in sala.",
  },
  beauty: {
    label: "Centri estetici e parrucchieri",
    icon: Scissors,
    problem: "Rispondere al telefono significa interrompere un trattamento o lasciare il cliente davanti.",
    capability: "Appuntamenti e informazioni sui servizi",
    customer: "Mi servirebbero taglio e colore sabato mattina. Quali orari avete?",
    assistant:
      "Controllo l'agenda per i servizi richiesti e ti propongo solo gli orari compatibili con durata, operatore e regole configurate.",
    result: "La prenotazione può essere preparata senza interrompere chi sta lavorando con il cliente.",
  },
  support: {
    label: "Assistenza Clienti",
    icon: Headphones,
    problem: "Le richieste semplici occupano lo stesso canale dei problemi che richiedono davvero un operatore.",
    capability: "Primo livello, raccolta dati ed escalation",
    customer: "Non riesco più ad accedere al mio account. Ho già provato a cambiare password.",
    assistant:
      "Ti aiuto con i controlli previsti. Se il problema non si risolve con la procedura approvata, raccolgo i dettagli tecnici utili e apro il passaggio al team di assistenza.",
    result: "Le richieste semplici vengono filtrate; quelle complesse arrivano al supporto con più contesto.",
  },
} as const;

type UseCaseKey = keyof typeof useCases;

export function UseCaseTabs() {
  const [active, setActive] = useState<UseCaseKey>("ecommerce");
  const current = useCases[active];
  const CurrentIcon = current.icon;

  return (
    <section
      id="use-cases"
      className="section-pad bg-gradient-to-b from-sky-50 via-white to-cyan-50/60 text-slate-900"
    >
      <div className="marketing-container">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border border-sky-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-700 shadow-sm">
              Esempi per attività
            </span>
            <h2 className="marketing-subheading mt-5 text-slate-950">
              Guarda come potrebbe interagire un cliente con ClerkAI nel tuo settore.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-slate-600 lg:justify-self-end">
            Seleziona un'attività. Ogni esempio mostra una richiesta tipica, la risposta della receptionist e cosa succede operativamente dopo la conversazione.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs leading-6 text-slate-600 sm:text-sm">
          Scenari dimostrativi, non conversazioni di clienti reali. Le azioni effettive dipendono dalle integrazioni, dalle informazioni approvate e dalle regole configurate per ogni attività.
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" role="tablist" aria-label="Esempi per settore">
            {(Object.entries(useCases) as Array<[UseCaseKey, (typeof useCases)[UseCaseKey]]>).map(([key, item]) => {
              const Icon = item.icon;
              const selected = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(key)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all duration-200",
                    selected
                      ? "border-sky-300 bg-white text-slate-950 shadow-[0_14px_35px_rgba(14,165,233,0.12)] ring-1 ring-sky-100"
                      : "border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:border-sky-200 hover:bg-sky-50/70 hover:text-slate-950",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        selected ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-bold leading-5">{item.label}</span>
                  </div>
                  <p className={cn("mt-3 text-xs leading-5", selected ? "text-slate-600" : "text-slate-500")}>{item.problem}</p>
                </button>
              );
            })}
          </div>

          <div className="min-h-[610px] overflow-hidden rounded-[2rem] border border-sky-200 bg-white shadow-[0_24px_65px_rgba(14,165,233,0.10)] sm:min-h-[560px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="flex h-full flex-col p-5 sm:p-7 lg:p-9"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <CurrentIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">{current.label}</p>
                    <h3 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.04em] text-slate-950 sm:text-3xl">{current.capability}</h3>
                  </div>
                  <span className="hidden rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700 sm:inline-flex">
                    Demo conversazione
                  </span>
                </div>

                <div className="mt-7 space-y-4" aria-label={`Esempio conversazione ${current.label}`}>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Cliente</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">“{current.customer}”</p>
                  </div>

                  <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">ClerkAI</p>
                    <p className="mt-2 text-sm leading-6 text-slate-800 sm:text-[15px] sm:leading-7">“{current.assistant}”</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Risultato operativo
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm">{current.result}</p>
                </div>

                <div className="mt-auto pt-6">
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-900">
                      <Building2 className="h-4 w-4 text-cyan-700" aria-hidden="true" />
                      Configurazione specifica dell'attività
                    </div>
                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      Prima del live vengono definite fonti utilizzabili, azioni consentite, integrazioni e percorso delle eccezioni. ClerkAI non deve inventare informazioni che non risultano configurate.
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
