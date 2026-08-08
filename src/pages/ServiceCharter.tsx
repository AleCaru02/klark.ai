import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileClock, LifeBuoy, PauseCircle, Scale, ShieldCheck, UserRoundCog, XCircle } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { MarketingPageHero } from "@/components/landing/MarketingPageHero";
import { Button } from "@/components/ui/button";
import { product } from "@/config/product";

const included = [
  "Analisi iniziale del processo e degli obiettivi",
  "Configurazione di voce, regole, informazioni e canali compresi nel piano",
  "Definizione di limiti, azioni vietate e passaggio umano",
  "Test e controlli di accettazione prima della messa online",
  "Dashboard con log, qualità e stato operativo delle funzioni",
  "Revisione periodica secondo la frequenza concordata",
];

const excluded = [
  "Decisioni professionali, mediche, legali o finanziarie al posto del cliente",
  "Garanzie su vendite, appuntamenti, conversioni o risparmi economici",
  "Disponibilità assoluta di servizi esterni o connettività",
  "Contenuti, prezzi o procedure non approvati dal cliente",
  "Attività fuori dal piano o integrazioni non configurate e collaudate",
];

const standards = [
  { icon: LifeBuoy, title: "Presa in carico", text: "Canali, priorità e modalità di supporto vengono definiti nei documenti di attivazione. I problemi bloccanti hanno precedenza sulle richieste ordinarie." },
  { icon: UserRoundCog, title: "Passaggio umano", text: "Motivo, dati raccolti, priorità e conversazione precedente possono restare disponibili nel percorso operativo previsto." },
  { icon: ShieldCheck, title: "Dipendenze esterne", text: "Telefonia, voce, calendario, messaggistica ed email possono dipendere da servizi terzi. Il sistema può rilevare errori, ma non ne controlla la disponibilità assoluta." },
  { icon: FileClock, title: "Modifiche", text: "Le modifiche vengono registrate, testate e portate online soltanto dopo i controlli necessari. Le variazioni ad alto rischio possono richiedere nuova approvazione." },
  { icon: Clock3, title: "Log e conservazione", text: "Accessi, conversazioni, audit e dati operativi seguono il periodo configurato e gli obblighi applicabili. Registrazione e trascrizione richiedono verifica specifica." },
  { icon: PauseCircle, title: "Sospensione", text: "Canali o automazioni possono essere disabilitati quando mancano credenziali valide, consenso, informazioni approvate o condizioni minime di sicurezza." },
];

const goLive = ["Obiettivo approvato", "Informazioni e FAQ approvate", "Responsabile umano definito", "Collegamenti necessari configurati", "Scenari normali ed eccezioni testati", "Privacy e conservazione valutate", "Fallback verificato", "Nessun problema bloccante aperto"];

export default function ServiceCharter() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <MarketingPageHero
          eyebrow="Standard del servizio"
          title={<>Carta del servizio <span className="text-primary">{product.name}</span></>}
          description={<>Cosa viene configurato, cosa resta responsabilità del cliente e quali condizioni devono essere verificate prima della messa online.</>}
          actions={<><Button size="lg" asChild><Link to="/analisi-flusso">Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/terms"><Scale className="h-4 w-4" aria-hidden="true" />Termini del servizio</Link></Button></>}
          aside={<div className="rounded-[1.75rem] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-[0_20px_60px_rgba(14,165,233,0.08)] sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Criterio operativo</p><h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">Il servizio è pronto quando sa anche quando non deve agire.</h2><div className="mt-5 grid gap-2 sm:grid-cols-2">{["Regole definite", "Collegamenti verificati", "Fallback testato", "Handoff assegnato"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white p-3 text-xs text-slate-700"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />{item}</div>)}</div></div>}
        />

        <section className="section-pad pt-8 md:pt-12"><div className="marketing-container grid gap-5 lg:grid-cols-2"><div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50/55 p-6 sm:p-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-xl font-bold tracking-[-0.035em] text-slate-950">Incluso nel servizio configurato</h2><p className="mt-1 text-xs text-slate-500">Il dettaglio finale dipende da piano e documento di attivazione.</p></div></div><ul className="mt-6 space-y-3">{included.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" /><span>{item}</span></li>)}</ul></div><div className="rounded-[1.75rem] border border-rose-100 bg-rose-50/45 p-6 sm:p-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-rose-600"><XCircle className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-xl font-bold tracking-[-0.035em] text-slate-950">Non incluso o non garantito</h2><p className="mt-1 text-xs text-slate-500">Questi limiti devono coincidere con contratto e comportamento tecnico.</p></div></div><ul className="mt-6 space-y-3">{excluded.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700"><XCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" /><span>{item}</span></li>)}</ul></div></div></section>

        <section className="section-pad bg-sky-50/45"><div className="marketing-container"><div className="max-w-3xl"><span className="marketing-eyebrow">Standard operativi</span><h2 className="marketing-subheading mt-5">Cosa succede quando il sistema incontra un limite.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{standards.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-sm sm:p-6"><Icon className="h-5 w-5 text-sky-700" aria-hidden="true" /><h3 className="mt-4 text-lg font-bold tracking-[-0.03em] text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></div></section>

        <section className="section-pad"><div className="marketing-container grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-sky-700" aria-hidden="true" /><h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">Criteri di messa online</h2></div><div className="mt-6 grid gap-2 sm:grid-cols-2">{goLive.map((item) => <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3.5 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{item}</div>)}</div></div><div className="rounded-[1.75rem] border border-amber-100 bg-amber-50/60 p-6 sm:p-7"><AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold text-slate-950">Documento informativo, non contratto definitivo</h2><p className="mt-3 text-sm leading-7 text-slate-600">Tempi, responsabilità, livelli di servizio, trattamento dati, costi e condizioni economiche diventano vincolanti soltanto nei documenti approvati e sottoscritti. Dati legali e condizioni definitive devono essere completati prima della vendita.</p></div></div></section>
      </main>
      <Footer />
    </div>
  );
}
