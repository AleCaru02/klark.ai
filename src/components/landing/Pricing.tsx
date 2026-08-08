import { motion } from "framer-motion";
import { BadgeCheck, Building2, Check, Crown, Phone, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { plans, type PlanCode } from "@/config/plans";
import { product } from "@/config/product";

const planIcons: Record<PlanCode, typeof Phone> = { essential: Phone, growth: Zap, pro: Crown, enterprise: Building2 };
const marketing: Record<PlanCode, { subtitle: string; highlights: string[] }> = {
  essential: { subtitle: "Per attività che vogliono iniziare dalla gestione delle chiamate e degli appuntamenti.", highlights: ["Receptionist telefonica configurata sulla tua attività", "Gestione delle richieste frequenti", "Agenda: prenota, sposta e cancella quando autorizzato", "Passaggio a una persona secondo le regole definite", "Configurazione standard e collaudo iniziale inclusi"] },
  growth: { subtitle: "Per chi vuole collegare telefono, richieste digitali e follow-up in un unico processo.", highlights: ["Tutto ciò che è incluso in Essential", "Gestione di lead e richieste provenienti dai canali previsti", "Chat del sito e WhatsApp quando configurati", "Follow-up e richiami secondo regole e consensi applicabili", "Più controllo su pipeline, priorità e consumi"] },
  pro: { subtitle: "Per team con più flussi, calendari e volumi da coordinare.", highlights: ["Tutto ciò che è incluso in Growth", "Più flussi operativi e calendari", "Base informativa più estesa e versionata", "Regole differenziate in base al tipo di richiesta", "Report, revisione conversazioni e supervisione del rollout"] },
  enterprise: { subtitle: "Per organizzazioni con più sedi, numeri, volumi o integrazioni su progetto.", highlights: ["Configurazione per più sedi o linee", "Volumi e limiti dimensionati sul caso reale", "Integrazioni e processi personalizzati", "Monitoraggio, escalation e supporto concordati", "Rollout e governance definiti nel progetto"] },
};

type PricingProps = { headingLevel?: "h1" | "h2" };

export function Pricing({ headingLevel = "h2" }: PricingProps) {
  const Heading = headingLevel;
  return (
    <section id="pricing" className="section-pad bg-sky-50/45">
      <div className="marketing-container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="marketing-eyebrow"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Prezzi</span>
          <Heading className="marketing-subheading mt-5">Scegli il livello di copertura adatto alla tua attività.</Heading>
          <p className="marketing-lead mt-5">I piani cambiano per volume e complessità del servizio. Prima dell'attivazione vengono chiariti consumi inclusi, costi extra e configurazione necessaria.</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const Icon = planIcons[plan.code];
            const copy = marketing[plan.code];
            const recommended = plan.recommended;
            return (
              <motion.article key={plan.code} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: index * 0.045 }} className={cn(
                "relative flex flex-col overflow-hidden rounded-[1.75rem] border bg-white p-5 text-slate-900 sm:p-6",
                recommended ? "border-sky-300 shadow-[0_22px_65px_rgba(14,165,233,0.12)] ring-1 ring-sky-100" : "border-slate-200 shadow-[0_8px_28px_rgba(15,23,42,0.035)]",
              )}>
                {recommended && <div className="absolute right-4 top-4 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">Più scelto per crescere</div>}
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", recommended ? "bg-sky-100 text-sky-700" : "bg-primary/[0.07] text-primary")}><Icon className="h-5 w-5" aria-hidden="true" /></div>
                <h3 className="mt-5 text-xl font-bold tracking-[-0.035em]">{plan.name}</h3>
                <p className="mt-2 min-h-20 text-sm leading-6 text-slate-600">{copy.subtitle}</p>
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-end gap-1.5">
                    {plan.pricePrefix && <span className="pb-1 text-xs font-semibold text-slate-500">{plan.pricePrefix}</span>}
                    <span className="text-4xl font-extrabold tracking-[-0.05em]">{plan.priceMonth}€</span>
                    <span className="pb-1 text-xs text-slate-500">/mese</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{plan.priceQuarter}€ fatturati ogni trimestre</p>
                </div>
                <ul className="mt-6 space-y-3">
                  {copy.highlights.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-xs leading-5 sm:text-sm"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-2.5 w-2.5" aria-hidden="true" /></span><span className="text-slate-700">{feature}</span></li>)}
                </ul>
                <div className={cn("mt-6 rounded-2xl border p-4", recommended ? "border-sky-100 bg-sky-50/70" : "border-slate-100 bg-slate-50")}>
                  <div className="flex items-center gap-2"><Sparkles className={cn("h-4 w-4", recommended ? "text-sky-700" : "text-primary")} aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.16em]">Incluso nel piano</p></div>
                  <ul className="mt-3 space-y-1.5">{plan.usage.map((item) => <li key={item} className="text-xs leading-5 text-slate-500">{item}</li>)}</ul>
                </div>
                <div className="mt-auto pt-6"><Button variant={recommended ? "default" : "outline"} className="w-full" size="lg" asChild><a href={`/analisi-flusso?plan=${plan.code}`}>{plan.code === "enterprise" ? "Richiedi una configurazione" : "Richiedi una demo"}</a></Button></div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-6 text-slate-500 sm:p-6">
          Prezzi IVA esclusa. Impegno minimo: {product.minimumCommitmentMonths} mesi. La disponibilità dei numeri, la compatibilità con linee esistenti e le funzioni collegate vengono verificate prima della messa online. L'attivazione è assistita: non raccogliamo pagamenti online da questa pagina.
        </div>
      </div>
    </section>
  );
}
