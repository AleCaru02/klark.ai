import { Check, Minus, PhoneCall } from "lucide-react";

const before = [
  "Chiamate che restano senza risposta",
  "Clienti che devono richiamare",
  "Appuntamenti gestiti interrompendo il lavoro",
  "Domande ripetitive ogni giorno",
  "Risposte diverse a seconda di chi prende il telefono",
  "Nessuna copertura quando l'attività è chiusa",
] as const;

const after = [
  "Una risposta immediata quando il servizio è attivo",
  "Richieste frequenti gestite secondo le informazioni approvate",
  "Dati utili raccolti durante la chiamata",
  "Appuntamenti gestiti quando il calendario è collegato e autorizzato",
  "Regole di risposta più coerenti",
  "Passaggio o raccolta della richiesta quando serve una persona",
] as const;

export function BeforeAfter() {
  return (
    <section className="section-pad bg-white">
      <div className="marketing-container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="marketing-eyebrow">Prima e dopo</span>
          <h2 className="marketing-subheading mt-5">Meno interruzioni. Più continuità nel modo in cui il telefono viene gestito.</h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-2">
          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/70 text-slate-600">
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Prima</p>
                <h3 className="mt-1 text-xl font-bold">Il telefono decide quando interromperti</h3>
              </div>
            </div>
            <ul className="mt-7 space-y-3">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                  <span className="mt-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Minus className="h-2.5 w-2.5" aria-hidden="true" /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.75rem] border border-primary/20 bg-primary/[0.035] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Check className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">Con ClerkAI</p>
                <h3 className="mt-1 text-xl font-bold">Le richieste seguono un percorso definito</h3>
              </div>
            </div>
            <ul className="mt-7 space-y-3">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/[0.1] text-success"><Check className="h-3 w-3" aria-hidden="true" /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
