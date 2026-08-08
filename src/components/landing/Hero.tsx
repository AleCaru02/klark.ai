import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Headphones, PhoneForwarded, UserRoundCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { product } from "@/config/product";
import { HeroProductPreview } from "@/components/landing/HeroProductPreview";

const assurances = [
  { icon: CheckCircle2, label: "Configurata sulla tua attività" },
  { icon: PhoneForwarded, label: "Collegabile al numero che usi già, quando compatibile" },
  { icon: UserRoundCheck, label: "Passa a una persona quando serve" },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-18 pt-28 sm:pb-20 md:pt-32 lg:pb-24 lg:pt-36">
      <div className="absolute inset-x-0 top-0 -z-20 h-[720px] bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_58%,transparent_100%)]" aria-hidden="true" />
      <div className="absolute -left-24 top-16 -z-10 h-80 w-80 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden="true" />
      <div className="absolute right-[-9rem] top-24 -z-10 h-96 w-96 rounded-full bg-accent/[0.07] blur-3xl" aria-hidden="true" />

      <div className="marketing-container">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 xl:gap-20">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="marketing-eyebrow mb-6"
            >
              Receptionist telefonica AI per aziende e professionisti
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="marketing-heading"
            >
              Una receptionist AI che risponde alle chiamate della tua attività, <span className="text-primary">anche quando tu non puoi.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.52, delay: 0.11 }}
              className="marketing-lead mt-7 max-w-xl"
            >
              {product.name} gestisce richieste, informazioni e appuntamenti con una voce naturale, seguendo gli orari,
              le regole e i limiti della tua attività. Le situazioni che richiedono una persona vengono inoltrate o raccolte per il team.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground"
            >
              Pensata per chi lavora con i clienti e non può interrompersi ogni volta che squilla il telefono.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Button size="xl" asChild>
                <Link to="/analisi-flusso">
                  Richiedi una demo
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <a href="#voice-demo">
                  <Headphones className="h-4 w-4" aria-hidden="true" />
                  Ascolta una chiamata
                </a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.27 }}
              className="mt-7 grid gap-3 sm:grid-cols-3"
            >
              {assurances.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-2.5 text-xs font-semibold leading-5 text-muted-foreground">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <HeroProductPreview />
        </div>
      </div>
    </section>
  );
}
