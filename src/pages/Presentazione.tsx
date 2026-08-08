import { ArrowRight, CalendarCheck, CheckCircle2, Clock3, Phone, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { MarketingPageHero } from "@/components/landing/MarketingPageHero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ExistingNumber } from "@/components/landing/ExistingNumber";
import { HumanHandoff } from "@/components/landing/HumanHandoff";
import { Pricing } from "@/components/landing/Pricing";
import { Button } from "@/components/ui/button";
import { product } from "@/config/product";

const principles = [
  { icon: Phone, title: "Risponde secondo il tuo modo di lavorare", text: "Saluto, tono, domande e informazioni vengono adattati alla tua attività prima della messa online." },
  { icon: CalendarCheck, title: "Gestisce l'agenda quando è previsto", text: "Disponibilità e regole vengono controllate prima di proporre o modificare un appuntamento." },
  { icon: Clock3, title: "Dà continuità nei momenti scoperti", text: "Può coprire chiamate quando il team è occupato o fuori orario, senza fingere che il personale sia disponibile." },
  { icon: UserRoundCheck, title: "Lascia spazio alle persone", text: "Le richieste che non devono essere automatizzate seguono il percorso umano configurato." },
  { icon: ShieldCheck, title: "Ha limiti definiti", text: "Informazioni, azioni consentite ed eccezioni vengono stabilite in anticipo per ridurre risposte improvvisate." },
  { icon: CheckCircle2, title: "Viene testata prima del live", text: "Il servizio non viene dichiarato pronto soltanto perché risponde: i principali scenari devono essere verificati." },
] as const;

export default function Presentazione() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <MarketingPageHero
          eyebrow="Come funziona ClerkAI"
          title={<>Una receptionist telefonica AI costruita <span className="text-primary">sulla tua attività.</span></>}
          description={<>{product.name} viene configurata per rispondere alle chiamate, usare le informazioni approvate, gestire appuntamenti quando previsto e coinvolgere una persona nei casi che non devono essere automatizzati.</>}
          actions={<><Button size="lg" asChild><a href="/analisi-flusso">Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></a></Button><Button variant="outline" size="lg" asChild><a href="/#voice-demo">Ascolta la voce</a></Button></>}
          aside={
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Una chiamata, un percorso chiaro</p>
              <div className="mt-5 space-y-2.5">
                {["La receptionist risponde", "Capisce la richiesta", "Controlla informazioni e regole", "Gestisce oppure coinvolge il team"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.08] text-[11px] font-bold text-primary">0{index + 1}</span>
                    <span className="text-sm font-semibold text-slate-700">{item}</span>
                    <CheckCircle2 className="ml-auto h-4 w-4 text-success" aria-hidden="true" />
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">Esempio illustrativo del comportamento, non dati di un cliente reale.</p>
            </div>
          }
        />

        <section className="section-pad pt-10 md:pt-14">
          <div className="marketing-container">
            <div className="max-w-3xl">
              <span className="marketing-eyebrow">Cosa fa la differenza</span>
              <h2 className="marketing-subheading mt-5">Non basta una bella voce. Deve sapere cosa fare e quando fermarsi.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {principles.map((item) => (
                <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.035)] sm:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary"><item.icon className="h-5 w-5" aria-hidden="true" /></div>
                  <h3 className="mt-5 text-lg font-bold tracking-[-0.03em]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />
        <ExistingNumber />
        <HumanHandoff />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
