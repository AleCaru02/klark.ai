import { motion } from "framer-motion";
import { CalendarClock, Gavel, HeartPulse, Home, Scissors, Wrench } from "lucide-react";

const useCases = [
  {
    icon: HeartPulse,
    sector: "Studio medico",
    scenario: "Il paziente chiama fuori orario, chiede disponibilità e riceve una conferma scritta dell'appuntamento.",
    control: "Urgenze cliniche escluse dal flusso e inoltrate secondo le regole definite dallo studio.",
  },
  {
    icon: Gavel,
    sector: "Studio professionale",
    scenario: "La chiamata viene qualificata, viene raccolto il motivo del contatto e viene proposta una consulenza negli slot disponibili.",
    control: "Nessun parere professionale viene generato al posto del titolare.",
  },
  {
    icon: Scissors,
    sector: "Centro estetico",
    scenario: "Il cliente prenota, sposta o annulla senza interrompere il lavoro dell'operatore.",
    control: "Durata, operatore, trattamento e buffer vengono verificati prima della conferma.",
  },
  {
    icon: Home,
    sector: "Property management",
    scenario: "La richiesta viene classificata tra informazione, appuntamento, problema operativo o urgenza.",
    control: "Le emergenze e le richieste fuori procedura passano a una persona.",
  },
  {
    icon: Wrench,
    sector: "Assistenza tecnica",
    scenario: "La segretaria raccoglie problema, recapito e disponibilità, poi pianifica il richiamo o l'intervento.",
    control: "Le promesse su tempi e costi seguono solo regole autorizzate.",
  },
  {
    icon: CalendarClock,
    sector: "Consulente",
    scenario: "Il contatto viene qualificato e inserito in agenda con riepilogo e promemoria.",
    control: "Il titolare vede storico, esito e prossima azione dalla dashboard.",
  },
];

export function Testimonials() {
  return (
    <section id="use-cases" className="py-24 lg:py-32 relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-20" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center mb-14"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            Scenari d'uso
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Il flusso cambia in base al{" "}
            <span className="text-gradient">tipo di attività</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Questi sono esempi operativi, non testimonianze o risultati garantiti. Ogni scenario viene configurato e testato prima dell'attivazione.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {useCases.map((item, index) => (
            <motion.article
              key={item.sector}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                <item.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold mb-3">{item.sector}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground mb-5">{item.scenario}</p>
              <div className="mt-auto rounded-xl bg-muted/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-1">Controllo previsto</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.control}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
