import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { AlertTriangle } from "lucide-react";
import { product } from "@/config/product";

const missingItems = [
  "identità completa, sede e dati fiscali del titolare del trattamento",
  "ruoli privacy tra piattaforma, cliente e fornitori",
  "elenco definitivo dei responsabili e sub-responsabili",
  "basi giuridiche distinte per sito, account, chiamate, messaggi e registrazioni",
  "tempi di conservazione effettivi per ogni categoria di dato",
  "eventuali trasferimenti extra SEE e relative garanzie",
  "canale formalizzato per l'esercizio dei diritti e per i reclami",
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pb-16 pt-28">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="mb-4 text-3xl font-bold text-slate-950">Informativa privacy pre-lancio</h1>
          <p className="mb-8 text-sm text-slate-500">Ultimo aggiornamento: 8 agosto 2026</p>

          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div><p className="font-semibold text-slate-900">Documento non ancora idoneo come informativa definitiva</p><p className="mt-1 text-sm leading-relaxed text-slate-600">Questa pagina descrive il perimetro previsto, ma non sostituisce l'informativa definitiva. Chiamate reali, registrazioni e ulteriori trattamenti devono essere attivati soltanto dopo aver completato e verificato i dati mancanti applicabili.</p></div>
          </div>

          <div className="prose prose-sm max-w-none space-y-5 text-slate-600">
            <h2 className="text-xl font-semibold text-slate-900">Servizio previsto</h2>
            <p>{product.name} è progettato per gestire chiamate, appuntamenti, messaggi, contatti e attività operative per conto dei clienti della piattaforma. A seconda della configurazione possono essere trattati dati di account, recapiti, informazioni fornite durante le conversazioni, eventi di calendario, log tecnici e consumi.</p>

            <h2 className="text-xl font-semibold text-slate-900">Richieste demo dal sito</h2>
            <p>Il modulo pubblico può raccogliere nome, attività, email, telefono facoltativo, settore, obiettivo e informazioni operative inserite volontariamente. Questi dati devono essere utilizzati per gestire la richiesta e non devono essere riutilizzati per finalità ulteriori senza una base giuridica appropriata.</p>

            <h2 className="text-xl font-semibold text-slate-900">Registrazioni e trascrizioni</h2>
            <p>Registrazione audio e trascrizione non sono funzioni obbligatorie e devono restare disattivate in assenza di configurazione, informativa e consenso o altra base giuridica applicabile. Il cliente che utilizza il servizio deve definire finalità, istruzioni, accessi e durata di conservazione.</p>

            <h2 className="text-xl font-semibold text-slate-900">Servizi tecnici</h2>
            <p>L'architettura può coinvolgere servizi di hosting, database, telefonia, sintesi vocale, elaborazione AI, calendario e messaggistica. L'elenco definitivo, le regioni di trattamento e gli accordi contrattuali devono essere verificati prima della produzione.</p>

            <h2 className="text-xl font-semibold text-slate-900">Sicurezza e accessi</h2>
            <p>Il progetto prevede separazione tra clienti, autorizzazioni per ruolo, segreti conservati lato server, verifica dei webhook, log tecnici e conservazione configurabile. Queste misure devono essere distribuite e testate sul backend effettivamente utilizzato prima di poterle dichiarare operative.</p>

            <h2 className="text-xl font-semibold text-slate-900">Informazioni ancora da completare</h2>
            <ul>{missingItems.map((item) => <li key={item}>{item}</li>)}</ul>

            <h2 className="text-xl font-semibold text-slate-900">Contatto provvisorio</h2>
            <p>Per segnalazioni relative al sito o alla preparazione dell'informativa: <a href={`mailto:${product.supportEmail}`} className="text-sky-700 hover:underline">{product.supportEmail}</a>.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
