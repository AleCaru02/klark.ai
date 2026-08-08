import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarCheck2, CheckCircle2, ClipboardList, Headphones, Loader2, MessageCircle, Pause, PhoneCall, Play, UserRoundCheck } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { MarketingPageHero } from "@/components/landing/MarketingPageHero";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const fallbackVoiceSample = "https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3";
const serverDemoEnabled = import.meta.env.VITE_PUBLIC_VOICE_DEMO_READY === "true";

const sectors = {
  professional: { label: "Studio professionale", caller: "Vorrei fissare un primo appuntamento e sapere quali informazioni devo preparare.", assistant: "Posso raccogliere il motivo della richiesta e verificare gli orari disponibili. Le informazioni specifiche verranno confermate dallo studio.", action: "Richiesta qualificata e appuntamento proposto", handoff: "Domanda specialistica passata al professionista con il contesto raccolto" },
  healthcare: { label: "Studio sanitario", caller: "Ho bisogno di spostare la visita e devo segnalare una richiesta urgente.", assistant: "Posso verificare lo spostamento. Per la richiesta urgente interrompo il flusso automatico e coinvolgo il referente indicato dallo studio.", action: "Appuntamento da riprogrammare e richiesta da inoltrare", handoff: "Passaggio prioritario senza fornire indicazioni mediche" },
  property: { label: "Gestione immobiliare", caller: "Ho un problema nell'appartamento e vorrei sapere quando può intervenire qualcuno.", assistant: "Raccolgo immobile, problema, urgenza e disponibilità. Se è presente un rischio o un blocco del soggiorno, passo il caso al responsabile.", action: "Segnalazione strutturata con priorità e contesto", handoff: "Responsabile operativo riceve immobile, descrizione e cronologia" },
  beauty: { label: "Centro estetico", caller: "Vorrei prenotare un trattamento e capire quale durata devo scegliere.", assistant: "Posso verificare i servizi approvati e proporre gli orari. Se la scelta richiede una valutazione professionale, raccolgo la richiesta e coinvolgo una persona.", action: "Servizio e fascia oraria raccolti", handoff: "Valutazione personale assegnata allo staff" },
  hospitality: { label: "Hotel / B&B", caller: "Arriveremo tardi questa sera. Come funziona il check-in?", assistant: "Posso darle la procedura approvata dalla struttura e raccogliere le informazioni necessarie. Se il caso richiede la reception, preparo il passaggio con il contesto.", action: "Richiesta ospite classificata e informazioni fornite", handoff: "Reception riceve motivo, arrivo previsto e dati raccolti" },
  restaurant: { label: "Ristorante", caller: "Vorrei prenotare un tavolo per quattro domani alle 20:30.", assistant: "Controllo le disponibilità previste. Se lo slot è realmente libero posso raccogliere nome e recapito e completare la richiesta secondo le regole del locale.", action: "Prenotazione verificata oppure richiesta raccolta", handoff: "Richiesta particolare passata al personale" },
  realestate: { label: "Agenzia immobiliare", caller: "Ho visto il trilocale in Via Verdi. Vorrei visitarlo sabato.", assistant: "Raccolgo l'immobile e le sue preferenze. Se l'agenda è collegata posso proporle soltanto gli slot realmente disponibili per la visita.", action: "Lead strutturato e visita da proporre", handoff: "Agente riceve immobile, esigenza e disponibilità" },
} as const;

type SectorKey = keyof typeof sectors;
type VoiceDemoResponse = { audioUrl?: string };

export default function OperationalDemo() {
  const [searchParams] = useSearchParams();
  const requestedSector = searchParams.get("sector") as SectorKey | null;
  const [sector, setSector] = useState<SectorKey>(requestedSector && requestedSector in sectors ? requestedSector : "professional");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const scenario = sectors[sector];
  const audioButtonLabel = loadingAudio ? "Caricamento del campione vocale" : playing ? "Ferma il campione vocale" : "Ascolta il campione vocale";

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlaying(false);
  };

  useEffect(() => () => stopAudio(), []);
  useEffect(() => stopAudio(), [sector]);

  const getAudioUrl = async () => {
    if (!serverDemoEnabled || !isSupabaseConfigured) return fallbackVoiceSample;
    const { data, error } = await supabase.functions.invoke<VoiceDemoResponse>("public-voice-demo", { body: { clipId: sector } });
    if (error || !data?.audioUrl) return fallbackVoiceSample;
    return data.audioUrl;
  };

  const toggleAudio = async () => {
    if (playing) { stopAudio(); return; }
    setLoadingAudio(true);
    try {
      const audio = new Audio(await getAudioUrl());
      audioRef.current = audio;
      audio.onplay = () => setPlaying(true);
      audio.onended = () => { audioRef.current = null; setPlaying(false); };
      audio.onerror = () => { audioRef.current = null; setPlaying(false); toast({ title: "Audio non disponibile", description: "Il campione vocale non è stato caricato. Riprova.", variant: "destructive" }); };
      await audio.play();
    } catch (error) {
      console.error("Unable to play voice sample", error);
      toast({ title: "Demo voce momentaneamente non disponibile", description: "Riprova tra poco.", variant: "destructive" });
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <MarketingPageHero
          eyebrow="Demo operativa"
          title={<>Guarda cosa succede <span className="text-primary">dopo la risposta.</span></>}
          description={<>Una voce naturale è il punto di partenza. Il valore è nel modo in cui la conversazione diventa una richiesta gestita, un appuntamento, un'informazione verificata oppure un passaggio umano.</>}
          actions={<><Button size="lg" asChild><Link to="/analisi-flusso">Richiedi una demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button><Button size="lg" variant="outline" onClick={toggleAudio} disabled={loadingAudio} aria-label={audioButtonLabel}>{loadingAudio ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}{loadingAudio ? "Carico la voce..." : playing ? "Ferma audio" : "Ascolta la voce"}</Button></>}
          aside={<div className="rounded-[1.75rem] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-[0_20px_60px_rgba(14,165,233,0.08)] sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Scegli il contesto</p><Select value={sector} onValueChange={(value) => setSector(value as SectorKey)}><SelectTrigger className="mt-4 h-12 border-sky-200 bg-white text-slate-900"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sectors).map(([key, value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select><p className="mt-4 text-xs leading-5 text-slate-500">Gli esempi illustrano il comportamento configurabile e non rappresentano risultati reali di un cliente.</p></div>}
        />

        <section className="section-pad pt-6 md:pt-10">
          <div className="marketing-container">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <article className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-[0_15px_45px_rgba(14,165,233,0.06)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-sky-700" aria-hidden="true" /><h2 className="text-sm font-bold text-slate-900">Conversazione di esempio</h2></div><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">{scenario.label}</span></div>
                <div className="p-5 sm:p-7">
                  <div className="max-w-[86%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Cliente</span>{scenario.caller}</div>
                  <div className="ml-auto mt-3 max-w-[90%] rounded-2xl rounded-br-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-700"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">ClerkAI</span>{scenario.assistant}</div>
                  <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center"><Button variant="outline" onClick={toggleAudio} disabled={loadingAudio} aria-label={audioButtonLabel}>{loadingAudio ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}{loadingAudio ? "Carico la voce..." : playing ? "Interrompi" : "Ascolta campione vocale"}</Button><p className="max-w-md text-[11px] leading-5 text-slate-500">Il campione audio valuta la resa vocale; la voce e il flusso definitivi vengono collaudati prima del live.</p></div>
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><ClipboardList className="h-5 w-5" aria-hidden="true" /></div><h2 className="mt-5 text-xl font-bold tracking-[-0.035em] text-slate-950">Azione registrata</h2><div className="mt-5 space-y-3">{[{ icon: CheckCircle2, title: "Esito del contatto", text: scenario.action }, { icon: CalendarCheck2, title: "Agenda o attività", text: "Creata soltanto se regole e disponibilità sono state verificate." }, { icon: MessageCircle, title: "Conferma", text: "Invio o conferma avvengono soltanto quando il canale previsto è configurato." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Icon className="h-4 w-4 text-sky-700" aria-hidden="true" />{title}</div><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div>)}</div></article>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
              <article className="rounded-[1.75rem] border border-amber-100 bg-amber-50/60 p-5 sm:p-6"><UserRoundCheck className="h-5 w-5 text-amber-600" aria-hidden="true" /><h2 className="mt-4 text-xl font-bold tracking-[-0.035em] text-slate-950">Passaggio umano</h2><p className="mt-3 text-sm leading-7 text-slate-600">{scenario.handoff}</p><div className="mt-5 grid grid-cols-2 gap-2">{["Motivo", "Priorità", "Dati raccolti", "Prossima azione"].map((item) => <div key={item} className="rounded-xl border border-amber-100 bg-white p-3 text-xs font-semibold text-slate-700">{item}</div>)}</div></article>
              <article className="rounded-[1.75rem] border border-sky-100 bg-sky-50/50 p-5 sm:p-6"><h2 className="text-xl font-bold tracking-[-0.035em] text-slate-950">Cosa deve uscire dalla configurazione</h2><div className="mt-5 grid gap-2 sm:grid-cols-2">{["Scenari da coprire e da vietare", "Dati obbligatori da raccogliere", "Responsabile e ordine di escalation", "Regole agenda e disponibilità", "Informazioni da approvare", "Test di accettazione prima del live"].map((item) => <div key={item} className="flex items-start gap-2 rounded-2xl bg-white p-3.5 text-xs leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />{item}</div>)}</div></article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
