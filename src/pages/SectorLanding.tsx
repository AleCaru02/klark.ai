import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarCheck2, CheckCircle2, ClipboardList, PhoneCall, ShieldAlert, UserRoundCheck } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { MarketingPageHero } from "@/components/landing/MarketingPageHero";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { product } from "@/config/product";

const sectorContent = {
  "studi-professionali": {
    title: "Receptionist AI per studi professionali",
    subtitle: "Gestisce richieste iniziali e appuntamenti senza sostituire il professionista nelle valutazioni che devono restare umane.",
    sector: "professional",
    sample: "Vorrei fissare un primo appuntamento e capire quali informazioni devo preparare.",
    problem: "Una prima telefonata può interrompere il lavoro anche quando serve soltanto raccogliere il motivo del contatto e organizzare un appuntamento.",
    situations: ["Il professionista è in riunione o con un cliente", "Il chiamante vuole sapere cosa preparare prima dell'incontro", "Serve distinguere una richiesta amministrativa da una domanda professionale"],
    useCases: ["Raccogliere motivo della richiesta e recapiti", "Proporre appuntamenti secondo regole e disponibilità", "Gestire conferme, spostamenti e richieste di richiamo", "Trasferire domande specialistiche con il contesto già raccolto"],
    benefits: ["Meno interruzioni durante consulenze e riunioni", "Richieste iniziali più ordinate", "Passaggio umano più rapido quando serve competenza professionale"],
    boundaries: ["Non fornire pareri professionali o interpretazioni vincolanti", "Non confermare preventivi, esiti o scadenze non approvati", "Non trattare documenti sensibili fuori dal flusso autorizzato"],
    faqs: [["Può rispondere a domande tecniche del cliente?", "Solo se l'informazione è stata approvata e non richiede una valutazione professionale. Negli altri casi raccoglie la richiesta e coinvolge lo studio."], ["Può fissare appuntamenti?", "Sì, quando l'agenda è collegata e le regole di disponibilità sono state configurate."], ["Il cliente può chiedere una persona?", "Sì. Il percorso umano può essere attivato quando viene richiesto o quando la domanda supera i limiti definiti."]],
  },
  "studi-sanitari": {
    title: "Receptionist AI per studi medici e sanitari",
    subtitle: "Supporta segreteria e agenda, mantenendo separate le attività amministrative dalle decisioni cliniche.",
    sector: "healthcare",
    sample: "Devo spostare la visita e segnalare una richiesta urgente allo studio.",
    problem: "Telefonate per appuntamenti e informazioni amministrative arrivano insieme a richieste che devono essere gestite dal personale sanitario.",
    situations: ["Il personale è impegnato con pazienti", "Un paziente vuole spostare una visita", "Una richiesta contiene elementi che non devono essere valutati automaticamente"],
    useCases: ["Prenotare, spostare o cancellare appuntamenti", "Raccogliere dati amministrativi e preferenze di contatto", "Dare informazioni organizzative approvate", "Inoltrare richieste che richiedono il personale"],
    benefits: ["Segreteria meno interrotta dalle richieste ripetitive", "Agenda gestita con regole più uniformi", "Confine esplicito tra amministrazione e attività clinica"],
    boundaries: ["Non formulare diagnosi o suggerimenti sanitari", "Non valutare la gravità clinica oltre le regole di escalation approvate", "Non registrare o trascrivere senza configurazione e verifica privacy"],
    faqs: [["Può dare consigli medici?", "No. La funzione è amministrativa e organizzativa; le richieste cliniche devono restare al personale sanitario."], ["Può spostare una visita?", "Sì, se l'agenda è collegata e lo spostamento rientra nelle regole configurate."], ["La registrazione delle chiamate è obbligatoria?", "No. Registrazione e trascrizione sono funzioni separate da valutare in base al contesto e alla privacy."]],
  },
  "gestione-immobiliare": {
    title: "Receptionist AI per property manager e gestione immobiliare",
    subtitle: "Struttura chiamate, appuntamenti e segnalazioni distinguendo richieste ordinarie, urgenze operative e passaggi al responsabile.",
    sector: "property",
    sample: "Ho un problema nell'appartamento e vorrei sapere quando può intervenire qualcuno.",
    problem: "Ospiti, proprietari e fornitori possono chiamare mentre il property manager è fuori sede, durante un check-in o impegnato su un altro immobile.",
    situations: ["Un ospite segnala un problema durante il soggiorno", "Un proprietario chiede un aggiornamento", "Serve raccogliere immobile, urgenza e disponibilità prima di coinvolgere il responsabile"],
    useCases: ["Raccogliere immobile, problema, urgenza e disponibilità", "Fissare sopralluoghi o richieste di contatto", "Classificare segnalazioni e assegnarle al responsabile", "Conservare contesto e prossima azione"],
    benefits: ["Segnalazioni più strutturate", "Meno telefonate senza contesto", "Passaggio più rapido dei casi che richiedono intervento umano"],
    boundaries: ["Non autorizzare spese, rimborsi o interventi non approvati", "Non promettere tempi di intervento non presenti nelle procedure", "Sospendere il flusso automatico in presenza di rischi o informazioni insufficienti"],
    faqs: [["Può gestire le emergenze?", "Può riconoscere regole di escalation definite e inoltrare il caso; non sostituisce i protocolli di emergenza né prende decisioni non autorizzate."], ["Può sapere a quale appartamento si riferisce l'ospite?", "Può raccogliere o usare identificativi disponibili nel flusso configurato, senza inventare dati mancanti."], ["Può prenotare un sopralluogo?", "Sì, quando l'agenda o il processo di disponibilità sono collegati e autorizzati."]],
  },
  ristoranti: {
    title: "Receptionist AI per ristoranti",
    subtitle: "Gestisce telefonate, prenotazioni e informazioni ricorrenti mentre sala e cucina restano concentrate sul servizio.",
    sector: "restaurant",
    sample: "Vorrei prenotare un tavolo per quattro domani alle 20:30. Avete posto?",
    problem: "Il telefono tende a squillare proprio durante preparazione, servizio e momenti in cui il personale ha meno possibilità di interrompersi.",
    situations: ["Un cliente chiama durante il servizio", "Arrivano più richieste di prenotazione insieme", "Vengono chiesti continuamente orari, indirizzo o informazioni approvate"],
    useCases: ["Raccogliere richieste di prenotazione", "Verificare disponibilità quando il sistema è collegato", "Rispondere a FAQ approvate", "Passare al personale richieste particolari"],
    benefits: ["Meno interruzioni in sala", "Risposte più continue anche nei picchi", "Prenotazioni raccolte con dati più ordinati"],
    boundaries: ["Non promettere tavoli o disponibilità senza verifica", "Non inventare ingredienti, allergeni o condizioni non approvate", "Passare al personale richieste che richiedono valutazione specifica"],
    faqs: [["Può confermare una prenotazione?", "Solo quando la disponibilità è realmente verificabile nel sistema collegato e la prenotazione rispetta le regole del locale."], ["Può rispondere sugli allergeni?", "Solo usando informazioni approvate; le richieste che richiedono conferma del personale devono essere inoltrate."], ["Può rispondere fuori orario?", "Sì, può dare continuità con informazioni approvate o raccogliere richieste senza fingere che il locale sia aperto."]],
  },
  "hotel-strutture-ricettive": {
    title: "Receptionist AI per hotel, B&B e strutture ricettive",
    subtitle: "Dà continuità alle chiamate su arrivi, servizi e richieste ospiti anche quando la reception non può rispondere subito.",
    sector: "hospitality",
    sample: "Arriviamo verso le 23:30. Come funziona il check-in tardivo?",
    problem: "Le richieste degli ospiti non seguono sempre gli orari della reception e spesso riguardano procedure ripetitive che devono comunque essere comunicate correttamente.",
    situations: ["Un ospite chiama per un arrivo tardivo", "La reception è impegnata con altri ospiti", "Serve distinguere una semplice informazione da un problema da passare allo staff"],
    useCases: ["Dare informazioni di arrivo e soggiorno approvate", "Raccogliere richieste e dati necessari", "Gestire richieste di richiamo", "Inoltrare problemi al referente previsto"],
    benefits: ["Più continuità fuori reception", "Meno domande ripetitive al banco", "Contesto raccolto prima del passaggio allo staff"],
    boundaries: ["Non inventare servizi o disponibilità", "Non promettere upgrade, rimborsi o eccezioni non autorizzate", "Non sostituire procedure di sicurezza o emergenza"],
    faqs: [["Può gestire un check-in tardivo?", "Può spiegare e seguire la procedura configurata per la struttura; non inventa accessi o istruzioni mancanti."], ["Può rispondere 24 ore su 24?", "Il servizio può essere configurato per coprire il fuori orario, ma il comportamento dipende dalle regole e dalle informazioni disponibili."], ["Può trasferire una chiamata alla reception?", "Quando il trasferimento è configurato e disponibile può seguire il percorso umano previsto; altrimenti può raccogliere la richiesta."]],
  },
  "centri-estetici-parrucchieri": {
    title: "Receptionist AI per centri estetici e parrucchieri",
    subtitle: "Gestisce richieste e appuntamenti senza costringere lo staff a interrompere un trattamento o lasciare il cliente davanti.",
    sector: "beauty",
    sample: "Mi servirebbero taglio e colore sabato mattina. Quali orari avete?",
    problem: "Rispondere al telefono durante un trattamento crea interruzioni proprio nel momento in cui l'attenzione dovrebbe restare sul cliente presente.",
    situations: ["Lo staff ha le mani occupate", "Un cliente vuole spostare l'appuntamento", "Serve capire durata e servizio prima di proporre un orario"],
    useCases: ["Raccogliere servizio richiesto e preferenze", "Proporre orari compatibili quando l'agenda è collegata", "Gestire spostamenti consentiti", "Rispondere a informazioni approvate su orari e servizi"],
    benefits: ["Meno interruzioni durante i trattamenti", "Agenda più ordinata", "Richieste raccolte anche quando nessuno può prendere il telefono"],
    boundaries: ["Non consigliare trattamenti che richiedono valutazione professionale", "Non promettere durata, prezzo o risultato se non configurati", "Non forzare disponibilità fuori dalle regole dell'agenda"],
    faqs: [["Può capire quanto dura un servizio?", "Può usare la durata configurata per ciascun servizio e proporre solo slot compatibili."], ["Può spostare un appuntamento?", "Sì, quando l'agenda è collegata e lo spostamento rispetta le regole definite."], ["Può consigliare un trattamento?", "Non se serve una valutazione professionale; in quel caso raccoglie la richiesta e coinvolge lo staff."]],
  },
  "agenzie-immobiliari": {
    title: "Receptionist AI per agenzie immobiliari",
    subtitle: "Raccoglie richieste sugli immobili, qualifica il contatto e organizza visite quando gli agenti sono in appuntamento o fuori sede.",
    sector: "realestate",
    sample: "Ho visto il trilocale in Via Verdi. È ancora disponibile? Vorrei visitarlo sabato.",
    problem: "Gli agenti passano molto tempo in visita, in auto o con altri clienti e non possono sempre rispondere mentre il lead è interessato.",
    situations: ["Un lead chiama durante una visita", "Serve capire a quale immobile è interessato", "Il contatto vuole fissare un appuntamento senza aspettare un richiamo"],
    useCases: ["Raccogliere immobile, budget ed esigenza", "Verificare informazioni approvate sull'annuncio", "Proporre visite quando l'agenda è collegata", "Passare lead qualificati all'agente"],
    benefits: ["Lead più strutturati", "Meno richieste perse mentre gli agenti sono fuori", "Informazioni utili raccolte prima del richiamo"],
    boundaries: ["Non inventare disponibilità o caratteristiche dell'immobile", "Non confermare condizioni economiche non approvate", "Non sostituire valutazioni, negoziazioni o verifiche professionali"],
    faqs: [["Può fissare una visita?", "Sì, se l'agenda dell'agente è collegata e lo slot è realmente disponibile."], ["Può rispondere alle domande sull'immobile?", "Solo usando informazioni approvate e aggiornate; se manca un dato raccoglie la domanda per l'agente."], ["Può qualificare un lead?", "Può raccogliere criteri come immobile, esigenza, budget indicativo e tempi, secondo il flusso definito dall'agenzia."]],
  },
} as const;

type SectorSlug = keyof typeof sectorContent;

export default function SectorLanding() {
  const { sector } = useParams<{ sector: string }>();
  const content = sectorContent[sector as SectorSlug];

  if (!content) return <div className="min-h-screen bg-white"><Navbar /><main className="marketing-container py-40 text-center"><h1 className="text-3xl font-bold text-slate-950">Settore non disponibile</h1><p className="mt-3 text-slate-600">Possiamo comunque valutare il tuo flusso specifico.</p><Button className="mt-6" asChild><Link to="/analisi-flusso">Richiedi una demo</Link></Button></main><Footer /></div>;

  const pageUrl = new URL(`/settori/${sector}`, product.publicUrl).toString();
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Service", name: content.title, description: content.subtitle, url: pageUrl, provider: { "@type": "Organization", name: product.name, url: product.publicUrl } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: product.publicUrl }, { "@type": "ListItem", position: 2, name: content.title, item: pageUrl }] },
      { "@type": "FAQPage", mainEntity: content.faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Navbar />
      <main>
        <MarketingPageHero
          eyebrow="Receptionist AI configurata sul settore"
          title={content.title}
          description={content.subtitle}
          actions={<><Button size="lg" asChild><Link to={`/demo-operativa?sector=${content.sector}`}>Guarda la demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button><Button size="lg" variant="outline" asChild><Link to={`/analisi-flusso?sector=${sector}`}>Richiedi una demo</Link></Button></>}
          aside={<div className="rounded-[1.75rem] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-[0_20px_60px_rgba(14,165,233,0.08)] sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Esempio di richiesta</p><div className="mt-4 rounded-2xl border border-sky-100 bg-white p-4 text-sm leading-7 text-slate-700">“{content.sample}”</div><div className="mt-4 grid grid-cols-2 gap-2">{[{ icon: PhoneCall, text: "Comprende" }, { icon: CalendarCheck2, text: "Verifica" }, { icon: ClipboardList, text: "Registra" }, { icon: UserRoundCheck, text: "Coinvolge" }].map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white p-3 text-xs text-slate-600"><Icon className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />{text}</div>)}</div><p className="mt-4 text-[10px] leading-5 text-slate-500">Scenario dimostrativo. Nessun risultato o dato cliente reale è implicato.</p></div>}
        />

        <section className="section-pad pt-8 md:pt-12"><div className="marketing-container grid gap-6 lg:grid-cols-[0.78fr_1.22fr]"><div><span className="marketing-eyebrow">Il problema</span><h2 className="marketing-subheading mt-5">Il telefono arriva mentre il lavoro è già in corso.</h2><p className="marketing-lead mt-5">{content.problem}</p></div><div className="grid gap-3 sm:grid-cols-3">{content.situations.map((item, index) => <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"><span className="text-[10px] font-bold tracking-[0.16em] text-sky-700">0{index + 1}</span><p className="mt-3 text-sm leading-6 text-slate-700">{item}</p></div>)}</div></div></section>

        <section className="section-pad bg-sky-50/45"><div className="marketing-container grid gap-5 lg:grid-cols-2"><article className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><ClipboardList className="h-5 w-5" aria-hidden="true" /></div><h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-slate-950">Cosa può gestire</h2><ul className="mt-6 space-y-3">{content.useCases.map((item) => <li key={item} className="flex items-start gap-2.5 rounded-2xl bg-slate-50 p-3.5 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />{item}</li>)}</ul></article><article className="rounded-[1.75rem] border border-amber-100 bg-amber-50/60 p-6 sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-600"><ShieldAlert className="h-5 w-5" aria-hidden="true" /></div><h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-slate-950">Cosa non deve fare</h2><ul className="mt-6 space-y-3">{content.boundaries.map((item) => <li key={item} className="flex items-start gap-2.5 rounded-2xl border border-amber-100 bg-white p-3.5 text-sm leading-6 text-slate-700"><ShieldAlert className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />{item}</li>)}</ul></article></div></section>

        <section className="section-pad"><div className="marketing-container"><div className="max-w-3xl"><span className="marketing-eyebrow">Benefici operativi</span><h2 className="marketing-subheading mt-5">Un servizio più continuo senza promettere risultati automatici.</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3">{content.benefits.map((benefit) => <div key={benefit} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /><p className="mt-4 text-sm font-semibold leading-6 text-slate-800">{benefit}</p></div>)}</div></div></section>

        <section className="section-pad bg-gradient-to-b from-cyan-50/50 to-white"><div className="marketing-container grid gap-8 lg:grid-cols-[0.7fr_1.3fr]"><div><span className="marketing-eyebrow">FAQ del settore</span><h2 className="marketing-subheading mt-5">Domande da chiarire prima del live.</h2></div><Accordion type="single" collapsible className="space-y-2.5">{content.faqs.map(([question, answer], index) => <AccordionItem key={question} value={`sector-faq-${index}`} className="rounded-2xl border border-slate-200 bg-white px-5"><AccordionTrigger className="py-5 text-left font-bold hover:no-underline">{question}</AccordionTrigger><AccordionContent className="pb-5 text-sm leading-7 text-slate-600">{answer}</AccordionContent></AccordionItem>)}</Accordion></div></section>

        <section className="section-pad"><div className="marketing-container"><div className="mx-auto max-w-4xl rounded-[2rem] border border-sky-200 bg-sky-50/70 p-6 text-center sm:p-9"><h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">Vediamo come dovrebbe rispondere nel tuo caso reale.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">La demo parte dalle tue chiamate, dal numero che usi e dalle regole che vuoi mantenere sotto controllo.</p><Button className="mt-6" size="lg" asChild><Link to={`/analisi-flusso?sector=${sector}`}>Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button></div></div></section>
      </main>
      <Footer />
    </div>
  );
}
