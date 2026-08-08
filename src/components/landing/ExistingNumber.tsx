import { motion } from "framer-motion";
import { ArrowRight, Clock3, PhoneForwarded, PhoneIncoming, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const options = [
  { icon: PhoneForwarded, title: "Inoltro verso la receptionist", text: "Quando la configurazione lo consente, il numero già conosciuto dai clienti può inoltrare le chiamate al servizio." },
  { icon: PhoneIncoming, title: "Deviazione quando non rispondi", text: "Il servizio può essere valutato come copertura quando il personale non prende la chiamata." },
  { icon: Clock3, title: "Copertura fuori orario", text: "È possibile studiare una deviazione limitata alle fasce in cui l'attività è chiusa." },
] as const;

export function ExistingNumber() {
  return (
    <section id="existing-number" className="section-pad bg-sky-50/45">
      <div className="marketing-container">
        <div className="overflow-hidden rounded-[2rem] border border-sky-200 bg-white shadow-[0_22px_70px_rgba(14,165,233,0.08)]">
          <div className="grid lg:grid-cols-[0.86fr_1.14fr]">
            <div className="border-b border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50/70 p-7 sm:p-9 lg:border-b-0 lg:border-r lg:p-11">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-700 shadow-sm"><PhoneForwarded className="h-5 w-5" aria-hidden="true" /></div>
              <span className="mt-6 block text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">Il tuo numero aziendale</span>
              <h2 className="mt-3 text-3xl font-extrabold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-4xl">Hai già un numero conosciuto dai clienti? Non devi ricominciare da zero.</h2>
              <p className="mt-5 text-sm leading-7 text-slate-600 sm:text-base">Prima di proporre una nuova linea valutiamo la configurazione telefonica esistente. L'obiettivo è mantenere, quando tecnicamente possibile, il numero che i clienti già utilizzano.</p>
              <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><p className="text-xs leading-6 text-slate-600">La soluzione dipende da operatore, linea, documentazione e configurazione disponibili. Non promettiamo portabilità o deviazioni che non siano state prima verificate.</p></div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              <p className="text-sm font-bold text-slate-900">Le configurazioni possibili vengono valutate caso per caso.</p>
              <div className="mt-5 grid gap-3">
                {options.map(({ icon: Icon, title, text }, index) => (
                  <motion.div key={title} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ duration: 0.32, delay: index * 0.05 }} className="flex gap-4 rounded-2xl border border-sky-100 bg-sky-50/45 p-4 sm:p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm"><Icon className="h-4 w-4" aria-hidden="true" /></div>
                    <div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1.5 text-xs leading-6 text-slate-600">{text}</p></div>
                  </motion.div>
                ))}
              </div>
              <Button className="mt-6" size="lg" asChild><Link to="/analisi-flusso">Verifica il tuo numero <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
