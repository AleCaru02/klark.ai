import { motion } from "framer-motion";
import { ArrowRight, ClipboardList, PhoneCall, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const steps = [
  { number: "01", icon: ClipboardList, title: "Ci racconti come lavora la tua attività", description: "Orari, servizi, domande frequenti, appuntamenti, persone di riferimento e casi che non devono essere gestiti automaticamente." },
  { number: "02", icon: Settings2, title: "Configuriamo la tua receptionist", description: "Definiamo voce, risposte, informazioni utilizzabili, comportamento, agenda, gestione del numero e percorso verso una persona." },
  { number: "03", icon: PhoneCall, title: "Inizia a rispondere secondo le tue regole", description: "Il servizio viene messo online solo dopo i test previsti. Le chiamate vengono gestite entro i limiti concordati e le eccezioni seguono il percorso umano definito." },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-pad bg-white">
      <div className="marketing-container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="marketing-eyebrow">Come funziona</span>
          <h2 className="marketing-subheading mt-5">Non devi imparare un nuovo software per capire il servizio.</h2>
          <p className="marketing-lead mt-5">Partiamo da come rispondi oggi e costruiamo una receptionist che lavora secondo le regole della tua attività.</p>
        </div>

        <div className="relative mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-3">
          <div className="absolute left-[16.5%] right-[16.5%] top-9 hidden h-px bg-sky-200 lg:block" aria-hidden="true" />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.article key={step.number} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: index * 0.06 }} className="relative rounded-[1.6rem] border border-sky-100 bg-white p-6 shadow-[0_10px_35px_rgba(14,165,233,0.05)] sm:p-7">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                <span className="mt-6 block text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-700">Passaggio {step.number}</span>
                <h3 className="mt-2 text-xl font-bold leading-tight tracking-[-0.035em] text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center"><Button variant="outline" className="border-sky-200 bg-white hover:bg-sky-50" asChild><Link to="/presentazione">Scopri l'attivazione completa <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button></div>
      </div>
    </section>
  );
}
