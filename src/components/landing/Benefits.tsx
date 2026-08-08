import { PhoneCall, CalendarCheck, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

const benefits = [
  {
    icon: PhoneCall,
    title: "Copertura senza dipendere dalla disponibilità dello staff",
    description: "Le chiamate seguono un flusso definito anche quando il titolare è occupato o l'attività è chiusa.",
    before: "Prima: chiamata persa o richiamo manuale",
    after: "Dopo: risposta, raccolta dati o passaggio previsto",
  },
  {
    icon: CalendarCheck,
    title: "Appuntamenti gestiti con le stesse regole",
    description: "Durata, buffer, preavviso e disponibilità non dipendono dalla memoria di chi risponde in quel momento.",
    before: "Prima: controlli e messaggi separati",
    after: "Dopo: verifica, azione e conferma nello stesso flusso",
  },
  {
    icon: ClipboardList,
    title: "Più visibilità su ciò che è successo",
    description: "Il titolare può ricostruire motivo del contatto, esito, appuntamento, messaggio e prossima attività.",
    before: "Prima: informazioni sparse tra telefono e agenda",
    after: "Dopo: storico consultabile e azioni tracciate",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            Benefici operativi
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Meno passaggi manuali, più{" "}
            <span className="text-gradient">coerenza nel servizio</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            I risultati economici dipendono da volume, processo e configurazione. Qui mostriamo il cambiamento operativo che il sistema deve produrre.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <motion.article
              key={benefit.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <benefit.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">{benefit.description}</p>
              <div className="space-y-2 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground">{benefit.before}</p>
                <p className="text-xs font-medium text-foreground">{benefit.after}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
