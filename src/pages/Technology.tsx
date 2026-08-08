import { ArrowRight, CalendarCheck, CheckCircle2, Headphones, MessageCircle, PhoneCall, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { MarketingPageHero } from "@/components/landing/MarketingPageHero";
import { Button } from "@/components/ui/button";

const capabilities = [
  { title: "Gestione telefonica", text: "Riceve la chiamata, riconosce il motivo del contatto e segue il percorso definito per l'attività.", icon: PhoneCall },
  { title: "Voce naturale", text: "La resa vocale viene scelta e collaudata sul caso reale, senza affidarsi al classico menu telefonico a tasti.", icon: Headphones },
  { title: "Appuntamenti", text: "Quando l'agenda è collegata può verificare disponibilità e gestire le azioni autorizzate.", icon: CalendarCheck },
  { title: "Informazioni controllate", text: "Risponde usando solo fonti e istruzioni approvate, con limiti espliciti su ciò che non deve decidere.", icon: ShieldCheck },
  { title: "Continuità tra richieste", text: "Le informazioni utili possono essere registrate per evitare che il personale riparta da zero quando interviene.", icon: MessageCircle },
  { title: "Passaggio umano", text: "Le richieste fuori regola, sensibili o esplicitamente rivolte a una persona seguono il percorso umano configurato.", icon: UserRoundCheck },
] as const;

const flow = [
  { title: "Arriva la richiesta", text: "Il sistema identifica il canale e il contesto previsto per quell'attività." },
  { title: "Capisce cosa serve", text: "Riconosce l'intento e raccoglie solo le informazioni necessarie per gestire il caso." },
  { title: "Controlla regole e fonti", text: "Prima di rispondere o agire usa le informazioni approvate e i limiti configurati." },
  { title: "Agisce oppure passa al team", text: "Se l'azione è consentita la esegue; altrimenti coinvolge una persona o registra la richiesta." },
] as const;

export default function Technology() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <MarketingPageHero
          eyebrow="Come è costruito il servizio"
          title={<>Una receptionist affidabile non deve soltanto parlare: deve <span className="text-primary">sapere cosa fare e quando fermarsi.</span></>}
          description={<>ClerkAI separa conversazione, informazioni, azioni consentite e passaggio umano. Ogni funzione viene considerata attiva soltanto dopo configurazione e test sul caso reale.</>}
          actions={<><Button asChild size="lg"><Link to="/analisi-flusso">Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button><Button asChild size="lg" variant="outline"><Link to="/demo-operativa">Guarda una demo operativa</Link></Button></>}
          aside={
            <div className="rounded-[1.75rem] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-[0_20px_60px_rgba(14,165,233,0.08)] sm:p-6">
              <div className="flex items-center gap-3"><Headphones className="h-5 w-5 text-sky-700" aria-hidden="true" /><div><p className="text-sm font-bold text-slate-900">Un flusso controllato</p><p className="text-xs text-slate-500">Conversazione, azione e limiti restano distinguibili.</p></div></div>
              <div className="mt-5 space-y-2.5">
                {["Ascolta e comprende la richiesta", "Consulta informazioni approvate", "Esegue solo azioni consentite", "Coinvolge una persona quando serve"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-white p-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-[11px] font-bold text-sky-700">0{index + 1}</span><span className="text-sm font-semibold text-slate-700">{item}</span><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-hidden="true" /></div>
                ))}
              </div>
              <p className="mt-5 text-[10px] leading-5 text-slate-500">Le integrazioni tecniche vengono scelte e verificate in base alla configurazione necessaria; non sono il prodotto venduto al cliente.</p>
            </div>
          }
        />

        <section className="section-pad pt-8 md:pt-12">
          <div className="marketing-container">
            <div className="max-w-3xl"><span className="marketing-eyebrow">Cosa deve funzionare davvero</span><h2 className="marketing-subheading mt-5">Sei capacità che rendono il servizio utile nella pratica.</h2></div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.035)] sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><item.icon className="h-4 w-4" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-bold tracking-[-0.03em] text-slate-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section-pad bg-gradient-to-b from-sky-50/70 via-white to-cyan-50/60">
          <div className="marketing-container">
            <div className="max-w-3xl"><span className="marketing-eyebrow">Dalla richiesta all'azione</span><h2 className="marketing-subheading mt-5">Il sistema non legge soltanto uno script.</h2><p className="marketing-lead mt-5 max-w-2xl">Usa fonti approvate, regole operative e strumenti configurati, mantenendo separato ciò che può automatizzare da ciò che richiede una persona.</p></div>
            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {flow.map((step, index) => <article key={step.title} className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /></div><span className="text-[10px] font-bold tracking-[0.16em] text-slate-400">0{index + 1}</span></div><h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="marketing-container"><div className="mx-auto max-w-4xl rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-6 sm:p-8 md:p-10"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">Nessuna funzione viene dichiarata attiva senza un test reale</h2><p className="mt-4 text-sm leading-7 text-slate-600">Numero telefonico, calendario, messaggistica, voce esterna e altri collegamenti richiedono configurazione, credenziali e collaudo. La dashboard distingue tra ciò che è pronto e ciò che deve ancora essere configurato.</p></div></div></div></div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
