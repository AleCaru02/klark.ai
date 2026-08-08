import { Navbar } from "@/components/landing/Navbar";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { product } from "@/config/product";

const faqs = [
  { q: "Cosa include il prezzo mensile?", a: "Ogni piano indica la copertura prevista, i consumi inclusi e il livello di configurazione. Prima dell'attivazione viene fornito un riepilogo con eventuali costi extra applicabili." },
  { q: "La configurazione iniziale è inclusa?", a: "La configurazione standard e il collaudo iniziale sono inclusi nei piani Essential, Growth e Pro. Integrazioni o progetti fuori standard vengono quotati prima dell'avvio." },
  { q: "Cosa succede se supero i minuti inclusi?", a: "Il piano prevede una tariffa per la voce extra. Soglie, avvisi e modalità di rendicontazione vengono chiariti prima della messa online." },
  { q: "Posso iniziare con un piano e poi passare a uno superiore?", a: "Il passaggio a un piano superiore può essere previsto. Tempi e condizioni vengono confermati in base alla configurazione attiva." },
  { q: "Qual è l'impegno minimo?", a: `L'impegno minimo dichiarato è di ${product.minimumCommitmentMonths} mesi, con fatturazione trimestrale. Le condizioni definitive vengono riportate nel contratto e nel riepilogo di attivazione.` },
  { q: "Come avviene l'attivazione?", a: "L'attivazione è assistita. Prima vengono verificati numero, flusso, funzioni richieste, limiti e test necessari. Questa pagina non raccoglie dati della carta né avvia pagamenti online." },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-20">
        <Pricing headingLevel="h1" />
        <section className="section-pad border-t border-slate-200 bg-white">
          <div className="marketing-container">
            <div className="grid gap-9 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="max-w-lg">
                <span className="marketing-eyebrow">Prima di scegliere</span>
                <h2 className="marketing-subheading mt-5">Prezzo chiaro, configurazione chiara.</h2>
                <p className="marketing-lead mt-5">La scelta del piano deve essere comprensibile senza conoscere l'infrastruttura tecnica. Quello che conta è la copertura che serve alla tua attività.</p>
              </div>
              <Accordion type="single" collapsible className="space-y-2.5">
                {faqs.map((faq, index) => (
                  <AccordionItem key={faq.q} value={`pricing-faq-${index}`} className="rounded-2xl border border-slate-200 bg-white px-5 shadow-[0_5px_18px_rgba(15,23,42,0.025)] sm:px-6">
                    <AccordionTrigger className="py-5 text-left text-sm font-bold hover:no-underline sm:text-base">{faq.q}</AccordionTrigger>
                    <AccordionContent className="pb-5 text-sm leading-7 text-slate-600">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
