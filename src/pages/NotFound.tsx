import { ArrowRight, Headphones, Home, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="relative overflow-hidden px-4 pb-20 pt-32 sm:pt-36">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-sky-50 via-white to-white" aria-hidden="true" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-700 shadow-sm">
            <Search className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Errore 404</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-5xl">Questa pagina non esiste o è stata spostata.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">Puoi tornare alla homepage, ascoltare una chiamata di esempio oppure richiedere una demo per capire come ClerkAI può adattarsi alla tua attività.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild><Link to="/"><Home className="h-4 w-4" aria-hidden="true" />Torna alla homepage</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/#voice-demo"><Headphones className="h-4 w-4" aria-hidden="true" />Ascolta una chiamata</Link></Button>
          </div>
          <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-sky-100 bg-sky-50/70 p-5 text-left sm:p-6">
            <p className="text-sm font-bold text-slate-900">Cerchi il servizio?</p>
            <Link to="/analisi-flusso" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800">Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
