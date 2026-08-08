import { motion } from "framer-motion";
import { CalendarCheck2, CheckCircle2, PhoneCall, UserRoundCheck } from "lucide-react";

const progress = [
  { label: "Risponde", detail: "La chiamata viene presa in carico" },
  { label: "Capisce", detail: "Riconosce la richiesta del cliente" },
  { label: "Agisce", detail: "Controlla disponibilità e regole" },
  { label: "Conferma", detail: "Chiude la richiesta o coinvolge il team" },
] as const;

export function HeroProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[650px] lg:max-w-none"
      aria-label="Esempio dimostrativo di una chiamata gestita da ClerkAI"
    >
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-sky-200/30 blur-3xl" aria-hidden="true" />
      <div className="overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-[0_28px_80px_rgba(14,165,233,0.11)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">Chiamata in arrivo · esempio</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Scenario dimostrativo, non dati reali</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            In linea
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-6 lg:border-r lg:border-slate-200/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Conversazione</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Prenotazione appuntamento</p>
              </div>
              <div className="flex items-end gap-1" aria-hidden="true">
                {[10, 18, 13, 25, 15, 21, 12, 19].map((height, index) => (
                  <span key={index} className="w-1 rounded-full bg-sky-500/55" style={{ height }} />
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-800">
                Buongiorno, Studio Aurora. Come posso aiutarla?
              </div>
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-800">
                Vorrei fissare un appuntamento per venerdì pomeriggio.
              </div>
              <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm leading-6 text-slate-800">
                Certo. Controllo le disponibilità previste per venerdì e le propongo gli orari liberi.
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <CalendarCheck2 className="h-4 w-4 text-sky-700" aria-hidden="true" />
                  Disponibilità verificata
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-500">Solo gli orari realmente consentiti vengono proposti.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <UserRoundCheck className="h-4 w-4 text-sky-700" aria-hidden="true" />
                  Persona disponibile
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-500">Le eccezioni possono essere passate al team secondo le regole definite.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-b from-sky-50 to-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">Cosa succede dietro la chiamata</p>
            <div className="mt-5 space-y-2.5">
              {progress.map((item, index) => (
                <div key={item.label} className="flex gap-3 rounded-2xl border border-sky-100 bg-white p-3.5 shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-xs font-extrabold text-sky-700">0{index + 1}</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <p className="text-[11px] leading-5 text-slate-600">La receptionist segue le informazioni e le regole configurate per l'attività. Se non deve decidere, non decide.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
