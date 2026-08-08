import { motion } from "framer-motion";
import { Clock3, MapPin, PhoneIncoming, Repeat2, Users, Workflow } from "lucide-react";

const situations = [
  { icon: Users, title: "Sei già con un cliente", text: "Non puoi interrompere ogni incontro per rispondere al telefono." },
  { icon: MapPin, title: "Sei fuori sede", text: "La richiesta arriva proprio quando non puoi prendere la chiamata." },
  { icon: PhoneIncoming, title: "Arrivano più chiamate insieme", text: "Una linea occupata può trasformarsi in una richiesta che non viene gestita." },
  { icon: Clock3, title: "Qualcuno chiama dopo l'orario", text: "Il cliente cerca una risposta anche quando il personale non è presente." },
  { icon: Repeat2, title: "Ripeti sempre le stesse informazioni", text: "Orari, disponibilità e domande frequenti occupano tempo ogni giorno." },
  { icon: Workflow, title: "L'agenda dipende da chi prende il telefono", text: "Le prenotazioni manuali aumentano interruzioni e passaggi da ricordare." },
] as const;

export function CallProblem() {
  return (
    <section className="section-pad bg-white">
      <div className="marketing-container">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.42 }}
            className="max-w-xl lg:sticky lg:top-28"
          >
            <span className="marketing-eyebrow">Il problema quotidiano</span>
            <h2 className="marketing-subheading mt-5">Ogni volta che non rispondi, quella richiesta resta senza una direzione.</h2>
            <p className="marketing-lead mt-5">
              Non serve inventare statistiche per capire il problema: il telefono squilla nei momenti peggiori. Una receptionist AI serve a dare continuità senza costringerti a lasciare ciò che stai facendo.
            </p>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2">
            {situations.map(({ icon: Icon, title, text }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-35px" }}
                transition={{ duration: 0.35, delay: index * 0.035 }}
                className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-5 sm:p-6"
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-base font-bold tracking-[-0.025em]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
