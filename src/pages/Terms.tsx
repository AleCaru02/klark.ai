import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { AlertTriangle } from "lucide-react";
import { product } from "@/config/product";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pb-16 pt-28">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="mb-4 text-3xl font-bold text-slate-950">Condizioni precontrattuali pre-lancio</h1>
          <p className="mb-8 text-sm text-slate-500">Ultimo aggiornamento: 8 agosto 2026</p>

          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900">Le condizioni commerciali definitive devono ancora essere completate</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Questa pagina descrive l'impostazione prevista ma non costituisce ancora un contratto definitivo. L'attivazione è assistita e non viene conclusa automaticamente dal sito.</p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none space-y-5 text-slate-600">
            <h2 className="text-xl font-semibold text-slate-900">Oggetto previsto</h2>
            <p>{product.name} è un servizio destinato a supportare la gestione di chiamate, appuntamenti, messaggi, contatti e flussi operativi. Funzioni disponibili e limiti dipendono dal piano e dalla configurazione approvata per ciascun cliente.</p>

            <h2 className="text-xl font-semibold text-slate-900">Attivazione</h2>
            <p>L'attivazione richiede analisi del processo, configurazione dei collegamenti necessari, disponibilità delle credenziali, collaudo e accettazione del perimetro operativo. Una richiesta inviata dal sito non equivale a conclusione automatica del contratto e non genera addebiti.</p>

            <h2 className="text-xl font-semibold text-slate-900">Prezzi e durata</h2>
            <p>Il listino pubblico indica canone mensile equivalente, totale trimestrale, consumo incluso e logica degli extra. L'impegno minimo previsto è di {product.minimumCommitmentMonths} mesi. Prezzo definitivo, IVA, eventuali extra e modalità di rinnovo devono comparire nel riepilogo contrattuale prima dell'attivazione.</p>

            <h2 className="text-xl font-semibold text-slate-900">Dipendenze da servizi esterni</h2>
            <p>Telefonia, messaggistica, calendario, elaborazione AI, sintesi vocale ed email possono dipendere da servizi esterni. Indisponibilità, sospensioni, modifiche tariffarie o limiti tecnici possono incidere sulle funzioni; continuità e responsabilità devono essere definite nel contratto definitivo.</p>

            <h2 className="text-xl font-semibold text-slate-900">Responsabilità del cliente</h2>
            <p>Il cliente deve fornire istruzioni accurate, mantenere aggiornate disponibilità e informazioni, verificare informative e basi giuridiche, evitare l'inserimento di dati non necessari e controllare gli esiti segnalati come eccezione o richiesta di intervento umano.</p>

            <h2 className="text-xl font-semibold text-slate-900">Limiti dell'intelligenza artificiale</h2>
            <p>Il servizio non sostituisce valutazioni mediche, legali, fiscali o professionali e non deve essere configurato per fornire pareri riservati a professionisti. Le azioni automatiche devono essere limitate a scenari definiti e testati.</p>

            <h2 className="text-xl font-semibold text-slate-900">Recesso, sospensione e condizioni economiche</h2>
            <p>Preavviso, rinnovo, sospensione, gestione degli extra, rimborsi e portabilità dei dati non sono ancora definiti in modo vincolante e devono essere completati prima dell'avvio commerciale con clienti paganti.</p>

            <h2 className="text-xl font-semibold text-slate-900">Contatto provvisorio</h2>
            <p>Per informazioni sul progetto: <a href={`mailto:${product.supportEmail}`} className="text-sky-700 hover:underline">{product.supportEmail}</a>.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
