import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  Handshake,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

const standards = [
  {
    icon: ClipboardList,
    title: "Ogni chiamata lascia un esito",
    description: "Motivo, contatto, azione eseguita e stato finale vengono registrati per evitare richieste perse o ambigue.",
  },
  {
    icon: CalendarCheck,
    title: "Agenda verificata prima di confermare",
    description: "Disponibilità, preavviso, durata, buffer e conflitti vengono controllati prima della prenotazione.",
  },
  {
    icon: MessageSquareText,
    title: "Conferma scritta dopo l'azione",
    description: "Quando previsto dal piano, il cliente riceve su WhatsApp il riepilogo corretto di prenotazione, spostamento o cancellazione.",
  },
  {
    icon: Handshake,
    title: "Passaggio a una persona quando serve",
    description: "Urgenze, eccezioni e richieste fuori procedura vengono segnalate senza inventare risposte o forzare una prenotazione.",
  },
  {
    icon: ShieldCheck,
    title: "Registrazione e trascrizione solo su consenso",
    description: "Audio, trascrizioni e conservazione dei log seguono le impostazioni del cliente e le regole di consenso configurate.",
  },
  {
    icon: BadgeCheck,
    title: "Test prima della messa online",
    description: "Numero, calendario, WhatsApp, regole di disponibilità e scenari critici vengono verificati nel Test Center.",
  },
];

export function ServiceStandards() {
  return (
    <section id="standards" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center mb-14"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            Standard operativi
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Non basta rispondere. Conta cosa succede{" "}
            <span className="text-gradient">dopo la chiamata</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Il servizio è progettato per trasformare ogni conversazione in un'azione verificabile,
            con regole chiare per agenda, messaggi, eccezioni e controllo umano.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {standards.map((standard, index) => (
            <motion.article
              key={standard.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                <standard.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{standard.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{standard.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
