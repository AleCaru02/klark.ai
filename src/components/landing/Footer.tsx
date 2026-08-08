import { ArrowRight, Headphones, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { product, supportMailto } from "@/config/product";

const linkClass = "text-sm text-slate-600 transition-colors hover:text-sky-700";

export function Footer() {
  return (
    <footer className="border-t border-sky-100 bg-gradient-to-b from-white to-sky-50/70 text-slate-900">
      <div className="marketing-container pt-10 sm:pt-14">
        <div className="overflow-hidden rounded-[2rem] border border-sky-200/80 bg-white px-5 py-10 shadow-[0_18px_55px_rgba(14,165,233,0.08)] sm:px-8 md:py-14 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Valuta il tuo caso reale</span>
              <h2 className="mt-5 text-3xl font-extrabold leading-[1.05] tracking-[-0.05em] text-slate-950 sm:text-4xl lg:text-5xl">Scopri come potrebbe rispondere il telefono della tua attività quando tu non puoi.</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">Partiamo da numero, chiamate, appuntamenti, informazioni e casi da passare a una persona. Nessuna configurazione viene data per compatibile prima della verifica.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button size="xl" asChild><Link to="/analisi-flusso">Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
              <Button variant="outline" size="xl" className="border-sky-200 bg-white hover:bg-sky-50" asChild><a href="/#voice-demo"><Headphones className="h-4 w-4" aria-hidden="true" /> Ascolta la voce</a></Button>
            </div>
          </div>
        </div>
      </div>

      <div className="marketing-container py-12 lg:py-16">
        <div className="grid gap-10 border-b border-slate-200 pb-12 md:grid-cols-2 xl:grid-cols-[1.35fr_0.7fr_0.9fr_0.75fr_0.75fr]">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label={`${product.name} homepage`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700"><Phone className="h-4 w-4" aria-hidden="true" /></div>
              <span className="text-xl font-extrabold tracking-[-0.04em] text-slate-950">{product.name}</span>
            </Link>
            <p className="mt-5 text-sm leading-7 text-slate-600">Receptionist telefonica AI per gestire chiamate, informazioni e appuntamenti secondo le regole della tua attività, con percorso umano quando necessario.</p>
            <a href={`mailto:${product.supportEmail}`} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-sky-700"><Mail className="h-4 w-4" aria-hidden="true" />{product.supportEmail}</a>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-800">Servizio</h3>
            <ul className="mt-5 space-y-3">
              <li><Link to="/presentazione" className={linkClass}>Come funziona</Link></li>
              <li><Link to="/demo-operativa" className={linkClass}>Demo operativa</Link></li>
              <li><Link to="/pricing" className={linkClass}>Prezzi</Link></li>
              <li><Link to="/analisi-flusso" className={linkClass}>Richiedi una demo</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-800">Settori</h3>
            <ul className="mt-5 space-y-3">
              <li><Link to="/settori/ristoranti" className={linkClass}>Ristoranti</Link></li>
              <li><Link to="/settori/hotel-strutture-ricettive" className={linkClass}>Hotel e B&B</Link></li>
              <li><Link to="/settori/centri-estetici-parrucchieri" className={linkClass}>Beauty e parrucchieri</Link></li>
              <li><Link to="/settori/agenzie-immobiliari" className={linkClass}>Agenzie immobiliari</Link></li>
              <li><Link to="/settori/studi-professionali" className={linkClass}>Studi professionali</Link></li>
              <li><Link to="/settori/studi-sanitari" className={linkClass}>Studi sanitari</Link></li>
              <li><Link to="/settori/gestione-immobiliare" className={linkClass}>Property manager</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-800">Approfondisci</h3>
            <ul className="mt-5 space-y-3">
              <li><Link to="/carta-servizio" className={linkClass}>Carta del servizio</Link></li>
              <li><Link to="/tecnologia" className={linkClass}>Come è costruito</Link></li>
              <li><Link to="/privacy" className={linkClass}>Privacy</Link></li>
              <li><Link to="/cookies" className={linkClass}>Cookie</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-800">Accesso</h3>
            <ul className="mt-5 space-y-3">
              <li><Link to="/login" className={linkClass}>Area clienti</Link></li>
              <li><a href={supportMailto("Richiesta informazioni ClerkAI")} className={linkClass}>Contatti</a></li>
              <li><Link to="/terms" className={linkClass}>Termini</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {product.legalName}. Tutti i diritti riservati.</p>
          <p>Funzioni e configurazioni vengono dichiarate attive solo dopo verifica e collaudo.</p>
        </div>
      </div>
    </footer>
  );
}
