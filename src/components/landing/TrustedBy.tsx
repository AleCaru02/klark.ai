import { CalendarCheck2, Clock3, PhoneCall, UserRoundCheck } from "lucide-react";

const outcomes = [
  { icon: PhoneCall, title: "Risponde mentre lavori", text: "Le richieste non devono aspettare che tu possa prendere il telefono." },
  { icon: CalendarCheck2, title: "Gestisce gli appuntamenti", text: "Può verificare disponibilità e applicare le regole definite per l'agenda." },
  { icon: Clock3, title: "Copre anche fuori orario", text: "Può dare continuità alle richieste quando il personale non è disponibile." },
  { icon: UserRoundCheck, title: "Sa quando coinvolgere una persona", text: "Le eccezioni possono essere inoltrate o raccolte per il referente corretto." },
] as const;

export function TrustedBy() {
  return (
    <section className="border-y border-border/70 bg-white" aria-label="Benefici principali del servizio">
      <div className="marketing-container py-7 sm:py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {outcomes.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl p-2 sm:p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-[-0.02em]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
