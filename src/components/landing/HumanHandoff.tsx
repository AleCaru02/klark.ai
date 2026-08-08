import { ArrowRight, MessageSquareText, ShieldAlert, UserRoundCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const triggers = [
  "Il cliente chiede esplicitamente di parlare con una persona",
  "La richiesta supera ciò che è stato autorizzato",
  "Serve una valutazione che non deve essere automatizzata",
  "È necessario raccogliere la richiesta e farla gestire al personale",
] as const;

export function HumanHandoff() {
  return (
    <section className="section-pad bg-white">
      <div className="marketing-container">
        <div className="grid overflow-hidden rounded-[2rem] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50/70 shadow-[0_24px_70px_rgba(14,165,233,0.08)] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="p-7 sm:p-9 lg:p-11">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-700 shadow-sm">
              <UserRoundCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="mt-6 block text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">Automazione con un limite chiaro</span>
            <h2 className="mt-3 text-3xl font-extrabold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-4xl">L'AI non deve sostituire ogni conversazione.</h2>
            <p className="mt-5 text-sm leading-7 text-slate-600 sm:text-base">
              Un servizio affidabile deve capire quando fermarsi. Il percorso umano viene definito prima del live, così il cliente non resta intrappolato in una conversazione automatica che non può aiutarlo.
            </p>
            <Button variant="outline" className="mt-7 border-sky-200 bg-white hover:bg-sky-50" asChild>
              <Link to="/demo-operativa">Guarda un esempio di handoff <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
          </div>

          <div className="border-t border-sky-100 bg-white/70 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <p className="text-sm font-bold text-slate-900">Quando può entrare in gioco una persona</p>
            <div className="mt-5 space-y-3">
              {triggers.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-xs font-extrabold text-sky-700">0{index + 1}</div>
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                <MessageSquareText className="h-4 w-4 text-cyan-700" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold text-slate-900">Raccoglie il contesto</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Il personale può ricevere le informazioni già raccolte, quando il flusso lo prevede.</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold text-slate-900">Non improvvisa oltre i limiti</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Le richieste non autorizzate devono essere bloccate, raccolte o inoltrate.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
