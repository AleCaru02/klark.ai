import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { product } from "@/config/product";

export default function Cookies() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pb-16 pt-28">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="mb-4 text-3xl font-bold text-slate-950">Cookie e tecnologie locali</h1>
          <p className="mb-8 text-sm text-slate-500">Ultimo aggiornamento: 8 agosto 2026</p>

          <div className="prose prose-sm max-w-none space-y-5 text-slate-600">
            <p>Questa pagina descrive l'impostazione attuale del progetto. Prima del lancio commerciale deve essere eseguito un inventario tecnico sul dominio definitivo per verificare cookie, local storage, SDK e strumenti di misurazione realmente caricati.</p>

            <h2 className="text-xl font-semibold text-slate-900">Tecnologie necessarie</h2>
            <p>L'area riservata può utilizzare tecnologie necessarie per sessione, autenticazione, sicurezza e preferenze dell'interfaccia. La disabilitazione può impedire login e funzioni della dashboard.</p>

            <h2 className="text-xl font-semibold text-slate-900">Consenso del sito</h2>
            <p>Il banner presente nel progetto deve riflettere soltanto tecnologie realmente utilizzate. Strumenti analitici, pubblicitari o di profilazione non devono essere caricati prima del consenso quando questo è richiesto.</p>

            <h2 className="text-xl font-semibold text-slate-900">Servizi di terze parti</h2>
            <p>Collegamenti esterni e integrazioni possono applicare proprie tecnologie quando l'utente visita domini esterni o completa procedure di autorizzazione. Informazioni, finalità e durata devono essere documentate dopo la configurazione definitiva.</p>

            <h2 className="text-xl font-semibold text-slate-900">Controllo dal browser</h2>
            <p>È possibile eliminare o bloccare cookie e dati locali dalle impostazioni del browser. Alcune funzioni strettamente necessarie potrebbero non funzionare correttamente.</p>

            <h2 className="text-xl font-semibold text-slate-900">Contatti</h2>
            <p>Per segnalazioni: <a href={`mailto:${product.supportEmail}`} className="text-sky-700 hover:underline">{product.supportEmail}</a>.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
