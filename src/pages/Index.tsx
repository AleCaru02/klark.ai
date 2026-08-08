import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import VoiceDemo from "@/components/landing/VoiceDemo";
import { CallProblem } from "@/components/landing/CallProblem";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { SolutionsOverview } from "@/components/landing/SolutionsOverview";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ExistingNumber } from "@/components/landing/ExistingNumber";
import { UseCaseTabs } from "@/components/landing/UseCaseTabs";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { Personalization } from "@/components/landing/Personalization";
import { HumanHandoff } from "@/components/landing/HumanHandoff";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppWidget } from "@/components/landing/WhatsAppWidget";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { plans } from "@/config/plans";
import { product } from "@/config/product";

const faqs = [
  {
    q: "La voce sembra davvero naturale?",
    a: "La demo permette di ascoltare un campione vocale. La voce definitiva viene scelta e collaudata sul flusso reale prima della messa online. L'obiettivo è evitare l'effetto del classico risponditore automatico, senza promettere che ogni conversazione sarà indistinguibile da una persona.",
  },
  {
    q: "Posso mantenere il numero che uso già?",
    a: "Spesso è possibile studiare una configurazione che mantenga il numero già conosciuto dai clienti, ad esempio tramite inoltro o deviazione. Dipende però da operatore, linea e configurazione esistente: la compatibilità viene verificata prima di promettere una soluzione.",
  },
  {
    q: "Cosa succede se un cliente vuole parlare con una persona?",
    a: "Il flusso può essere configurato per riconoscere la richiesta e seguire il percorso umano definito: trasferimento quando disponibile oppure raccolta della richiesta e dei dati necessari per il personale.",
  },
  {
    q: "Può rispondere quando siamo chiusi?",
    a: "Sì, il servizio può essere configurato per dare continuità fuori orario, fornire informazioni approvate o raccogliere richieste. Non deve però fingere che il personale sia disponibile quando non lo è.",
  },
  {
    q: "Posso decidere cosa può e non può dire?",
    a: "Sì. Durante la configurazione vengono definite informazioni utilizzabili, azioni consentite, casi da bloccare e situazioni da passare a una persona.",
  },
  {
    q: "Come fa a conoscere i servizi della mia attività?",
    a: "La receptionist usa le informazioni messe a disposizione e approvate per il servizio: servizi, orari, sedi, FAQ, procedure e altre conoscenze previste dalla configurazione.",
  },
  {
    q: "Può gestire appuntamenti?",
    a: "Quando il calendario è collegato e le regole sono definite, può verificare disponibilità e gestire prenotazioni, spostamenti o cancellazioni consentite dal flusso.",
  },
  {
    q: "Quanto tempo serve per configurarla?",
    a: "Dipende da numero telefonico, quantità di informazioni, calendario e complessità delle regole. L'attivazione avviene solo dopo configurazione e test degli scenari principali; non indichiamo tempi fissi non verificati.",
  },
  {
    q: "Cosa succede se non conosce una risposta?",
    a: "Non dovrebbe inventarla. Il comportamento previsto è fermarsi, spiegare il limite e, quando configurato, raccogliere o inoltrare la richiesta al referente corretto.",
  },
  {
    q: "Posso modificare le informazioni successivamente?",
    a: "Sì. Le informazioni e le regole operative possono essere aggiornate attraverso gli strumenti e i processi previsti dal servizio, mantenendo controllo sulle fonti utilizzate.",
  },
  {
    q: "Registrazione e trascrizione delle chiamate sono obbligatorie?",
    a: "No. Sono funzioni da configurare separatamente. Informativa, consenso quando richiesto e tempi di conservazione devono essere valutati in base al contesto reale del cliente.",
  },
  {
    q: "Il pagamento online è già attivo?",
    a: "Non ancora. I prezzi sono pubblicati, ma l'attivazione resta assistita finché prodotti, prezzi, webhook e checkout live non sono verificati end-to-end. Il sito non raccoglie dati della carta in questa fase.",
  },
];

const monthlyPrices = plans.map((plan) => plan.priceMonth);
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: product.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: product.publicUrl,
      description: "Receptionist telefonica AI per aziende e professionisti: gestione di chiamate, informazioni e appuntamenti con regole definite e passaggio a una persona quando necessario.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: String(Math.min(...monthlyPrices)),
        highPrice: String(Math.max(...monthlyPrices)),
        priceCurrency: product.currency,
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ],
};

const Index = () => {
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const visibleFaqs = showAllFaqs ? faqs : faqs.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main>
        <Hero />
        <VoiceDemo />
        <CallProblem />
        <TrustedBy />
        <SolutionsOverview />
        <HowItWorks />
        <ExistingNumber />
        <UseCaseTabs />
        <BeforeAfter />
        <Personalization />
        <HumanHandoff />
        <Pricing />

        <motion.section
          id="faq"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="section-pad bg-white"
        >
          <div className="marketing-container">
            <div className="grid gap-9 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div className="max-w-xl lg:sticky lg:top-28">
                <span className="marketing-eyebrow">Domande frequenti</span>
                <h2 className="marketing-subheading mt-5">Le obiezioni da chiarire prima di mettere una receptionist AI al telefono.</h2>
                <p className="marketing-lead mt-5">
                  Numero esistente, voce, appuntamenti, passaggio umano e limiti vengono chiariti prima della configurazione. Meglio una risposta precisa che una promessa commerciale impossibile da garantire.
                </p>
              </div>

              <div>
                <Accordion type="single" collapsible className="space-y-2.5">
                  {visibleFaqs.map((faq, index) => (
                    <AccordionItem
                      key={faq.q}
                      value={`faq-${index}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 shadow-[0_5px_18px_rgba(15,23,42,0.025)] transition-colors data-[state=open]:border-primary/20 sm:px-6"
                    >
                      <AccordionTrigger className="py-5 text-left text-sm font-bold tracking-[-0.02em] hover:no-underline sm:text-base">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-sm leading-7 text-muted-foreground">{faq.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {!showAllFaqs && (
                  <div className="mt-5 flex justify-end">
                    <Button variant="outline" onClick={() => setShowAllFaqs(true)}>
                      Mostra tutte le domande
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </main>
      <Footer />
      <WhatsAppWidget />
    </div>
  );
};

export default Index;
