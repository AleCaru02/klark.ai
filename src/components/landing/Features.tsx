import {
  Phone,
  Calendar,
  MessageCircle,
  ListChecks,
  ShieldCheck,
  Facebook,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Phone,
    title: "Conversazioni vocali configurate",
    description: "Accoglienza, domande, raccolta dati, appuntamenti e passaggio a una persona seguono istruzioni specifiche per l'attività.",
    color: "primary" as const,
  },
  {
    icon: Calendar,
    title: "Agenda con controlli reali",
    description: "Disponibilità, durata, buffer, preavviso e conflitti vengono verificati prima di prenotare, spostare o cancellare.",
    color: "primary" as const,
  },
  {
    icon: MessageCircle,
    title: "WhatsApp collegato al flusso",
    description: "Conferme, promemoria e richieste di conferma vengono inviate in base al piano e alle regole approvate.",
    color: "success" as const,
  },
  {
    icon: ListChecks,
    title: "Esito e prossima azione",
    description: "Ogni interazione può aggiornare contatto, appuntamento, stato del lead, riepilogo e attività da svolgere.",
    color: "accent" as const,
  },
  {
    icon: ShieldCheck,
    title: "Controlli, consenso e Test Center",
    description: "Registrazione e trascrizione sono opt-in. Le integrazioni e gli scenari principali vengono verificati prima dell'attivazione.",
    color: "primary" as const,
  },
  {
    icon: Facebook,
    title: "Meta Lead Ads e follow-up",
    description: "Nel piano Full, i lead possono entrare nel CRM e seguire code di contatto, tentativi e stop automatici configurabili.",
    color: "accent" as const,
    badge: "Piano Full",
  },
];

const colorClasses = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
};

export function Features() {
  return (
    <section id="features" className="py-24 lg:py-32 relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            Funzionalità
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Una segretaria AI non è solo{" "}
            <span className="text-gradient">una voce al telefono</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Il valore è nel collegamento tra conversazione, agenda, WhatsApp, CRM,
            controlli ed eccezioni gestite correttamente.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="group p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 relative"
            >
              {feature.badge && (
                <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  {feature.badge}
                </span>
              )}
              <div className={`w-14 h-14 rounded-xl ${colorClasses[feature.color]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
