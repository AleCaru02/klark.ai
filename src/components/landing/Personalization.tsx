import { BookOpenCheck, Building2, CalendarDays, Clock3, ListChecks, MapPin, ShieldCheck, Tags } from "lucide-react";

const knowledge = [
  { icon: Tags, label: "Servizi e prezzi approvati" },
  { icon: Clock3, label: "Orari e giorni di apertura" },
  { icon: MapPin, label: "Sedi e informazioni logistiche" },
  { icon: BookOpenCheck, label: "Domande frequenti" },
  { icon: CalendarDays, label: "Regole di prenotazione" },
  { icon: ListChecks, label: "Procedure e casi particolari" },
  { icon: Building2, label: "Informazioni specifiche dell'attività" },
  { icon: ShieldCheck, label: "Casi in cui deve fermarsi o passare la richiesta" },
] as const;

export function Personalization() {
  return (
    <section className="section-pad bg-[#f7f8fa]">
      <div className="marketing-container">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-xl">
            <span className="marketing-eyebrow">Non è una receptionist generica</span>
            <h2 className="marketing-subheading mt-5">Impara come lavora la tua attività.</h2>
            <p className="marketing-lead mt-5">
              Prima dell'attivazione raccogliamo le informazioni che la receptionist può usare e definiamo le regole che deve rispettare. Il servizio non dovrebbe inventare ciò che non conosce.
            </p>
            <div className="mt-6 rounded-2xl border border-primary/12 bg-primary/[0.04] p-4 text-sm leading-6 text-slate-700">
              Le informazioni possono essere aggiornate successivamente attraverso gli strumenti e i processi previsti dal servizio.
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {knowledge.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(15,23,42,0.03)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold leading-5 text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
