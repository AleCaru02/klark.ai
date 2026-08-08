import { motion } from "framer-motion";
import {
  CalendarCheck2,
  Clock3,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

const benefits = [
  {
    icon: PhoneCall,
    title: "Non lasciare senza risposta le chiamate importanti",
    text: "Quando sei con un cliente, fuori sede o semplicemente occupato, la receptionist può prendere in carico la richiesta secondo le regole definite.",
  },
  {
    icon: CalendarCheck2,
    title: "Gestisci appuntamenti senza interrompere il lavoro",
    text: "Può verificare disponibilità, proporre gli slot consentiti e gestire prenotazioni, spostamenti o cancellazioni quando il flusso lo permette.",
  },
  {
    icon: Clock3,
    title: "Dai una risposta anche fuori orario",
    text: "Il cliente può trovare una prima risposta o lasciare una richiesta anche quando il personale non è presente.",
  },
  {
    icon: MessageSquareText,
    title: "Riduci le domande ripetitive al team",
    text: "Orari, servizi, sedi, modalità operative e altre informazioni approvate possono essere comunicate in modo coerente.",
  },
  {
    icon: UserRoundCheck,
    title: "Passa la conversazione a una persona quando serve",
    text: "Se il cliente chiede un operatore o la situazione supera i limiti stabiliti, il sistema può attivare il percorso umano previsto.",
  },
  {
    icon: ShieldCheck,
    title: "Decidi cosa può e cosa non può fare",
    text: "Non viene installato un assistente generico: comportamento, informazioni, azioni consentite ed eccezioni vengono definite per la tua attività.",
  },
] as const;

export function SolutionsOverview() {
  return (
    <section id="solutions" className="section-pad bg-[#f7f8fa]">
      <div className="marketing-container">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
          <div className="max-w-2xl">
            <span className="marketing-eyebrow">Quello che cambia nel lavoro quotidiano</span>
            <h2 className="marketing-subheading mt-5">Il telefono continua a lavorare anche quando tu hai altro da fare.</h2>
          </div>
          <p className="marketing-lead max-w-2xl lg:justify-self-end">
            Il valore non è avere "un'AI". È evitare che ogni squillo diventi un'interruzione, mantenendo una risposta professionale e un percorso chiaro per le richieste che richiedono il team.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.38, delay: index * 0.04 }}
              className="group rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.035)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:p-7"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-xl font-bold leading-tight tracking-[-0.035em]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
