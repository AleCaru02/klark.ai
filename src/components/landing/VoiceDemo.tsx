import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock3, Headphones, Info, Loader2, Play, UserRoundCheck, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const fallbackVoiceSample =
  "https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3";
const serverDemoEnabled = import.meta.env.VITE_PUBLIC_VOICE_DEMO_READY === "true";

const scenarios = [
  { id: "appointment", label: "Prenotazione", icon: Calendar, outcome: "Controlla l'agenda e propone solo disponibilità consentite", messages: [
    { role: "assistant", text: "Buongiorno, come posso aiutarla?" },
    { role: "user", text: "Vorrei prenotare per venerdì pomeriggio." },
    { role: "assistant", text: "Certo. Verifico le disponibilità previste per venerdì e le propongo gli orari liberi." },
    { role: "user", text: "Le 16:30 andrebbero bene." },
    { role: "assistant", text: "Perfetto. Se lo slot risulta ancora disponibile, procedo con la prenotazione secondo le regole dello studio." },
  ] },
  { id: "information", label: "Informazioni", icon: Info, outcome: "Usa soltanto informazioni approvate dall'attività", messages: [
    { role: "assistant", text: "Buongiorno, come posso aiutarla?" },
    { role: "user", text: "A che ora chiudete oggi e dove posso parcheggiare?" },
    { role: "assistant", text: "Le do volentieri le informazioni disponibili per oggi e le indicazioni che l'attività ha approvato." },
  ] },
  { id: "human", label: "Parlare con una persona", icon: UserRoundCheck, outcome: "Riconosce la richiesta e segue il percorso umano configurato", messages: [
    { role: "assistant", text: "Buongiorno, come posso aiutarla?" },
    { role: "user", text: "Preferisco parlare direttamente con una persona." },
    { role: "assistant", text: "Certo. Seguo il percorso previsto per metterla in contatto con il personale o registrare la richiesta con il contesto necessario." },
  ] },
  { id: "after-hours", label: "Fuori orario", icon: Clock3, outcome: "Dà continuità senza fingere che il personale sia disponibile", messages: [
    { role: "assistant", text: "Buonasera. In questo momento l'attività è chiusa, ma posso aiutarla con le informazioni disponibili o raccogliere la sua richiesta." },
    { role: "user", text: "Vorrei essere richiamato domani per un preventivo." },
    { role: "assistant", text: "Va bene. Raccolgo i dati necessari e preparo la richiesta per il team secondo la procedura prevista." },
  ] },
] as const;

type ScenarioId = (typeof scenarios)[number]["id"];
type VoiceDemoResponse = { audioUrl?: string };

export default function VoiceDemo() {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("appointment");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playing, setPlaying] = useState(false);
  const scenario = useMemo(() => scenarios.find((item) => item.id === scenarioId) ?? scenarios[0], [scenarioId]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlaying(false);
  };

  useEffect(() => () => stopAudio(), []);
  useEffect(() => stopAudio(), [scenarioId]);

  const getAudioUrl = async () => {
    if (!serverDemoEnabled || !isSupabaseConfigured) return fallbackVoiceSample;
    const { data, error } = await supabase.functions.invoke<VoiceDemoResponse>("public-voice-demo", { body: { clipId: scenarioId } });
    if (error || !data?.audioUrl) return fallbackVoiceSample;
    return data.audioUrl;
  };

  const playPreview = async () => {
    if (playing) {
      stopAudio();
      return;
    }
    setLoadingAudio(true);
    try {
      const audio = new Audio(await getAudioUrl());
      audioRef.current = audio;
      audio.onplay = () => setPlaying(true);
      audio.onended = () => { audioRef.current = null; setPlaying(false); };
      audio.onerror = () => {
        audioRef.current = null;
        setPlaying(false);
        toast({ title: "Audio non disponibile", description: "Il campione vocale non è stato caricato. Riprova.", variant: "destructive" });
      };
      await audio.play();
    } catch (error) {
      console.error("Unable to play voice sample", error);
      toast({ title: "Demo voce momentaneamente non disponibile", description: "Riprova tra poco.", variant: "destructive" });
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    <section id="voice-demo" className="section-pad bg-gradient-to-b from-cyan-50/70 via-white to-sky-50/70 text-slate-900">
      <div className="marketing-container">
        <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.42 }} className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-700 shadow-sm">
              <Headphones className="h-3.5 w-3.5" aria-hidden="true" /> Demo voce
            </span>
            <h2 className="marketing-subheading mt-5 text-slate-950">Non immaginare come parla. Ascoltala.</h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              La qualità della voce è importante, ma da sola non basta. Guarda anche come la receptionist gestisce una richiesta, quando verifica un'informazione e quando lascia spazio a una persona.
            </p>

            <div className="mt-7 rounded-3xl border border-sky-100 bg-white p-5 shadow-[0_16px_45px_rgba(14,165,233,0.07)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Volume2 className="h-5 w-5" aria-hidden="true" /></div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Campione di voce naturale</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">La voce finale viene scelta e collaudata sul caso reale. Il campione serve a valutare la resa vocale e non rappresenta una conversazione cliente già attiva.</p>
                </div>
              </div>
              <Button onClick={playPreview} disabled={loadingAudio} size="lg" className="mt-5 w-full sm:w-auto" aria-live="polite">
                {loadingAudio ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                {loadingAudio ? "Carico l'audio..." : playing ? "Ferma audio" : "Ascolta la voce"}
              </Button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.48, delay: 0.05 }} className="overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(14,165,233,0.08)]">
            <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 sm:p-4" role="tablist" aria-label="Scenari della demo telefonica">
              {scenarios.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={scenarioId === id} onClick={() => setScenarioId(id)} className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm",
                  scenarioId === id ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50/60 hover:text-slate-900",
                )}>
                  <Icon className="h-4 w-4" aria-hidden="true" />{label}
                </button>
              ))}
            </div>

            <div className="grid min-h-[420px] md:grid-cols-[1fr_230px]">
              <div className="space-y-3 p-5 sm:p-7">
                {scenario.messages.map((message, index) => (
                  <motion.div key={`${scenario.id}-${index}`} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}> 
                    <div className={cn("max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6", message.role === "user" ? "rounded-br-md border border-sky-200 bg-sky-50 text-slate-800" : "rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800")}>{message.text}</div>
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-slate-200 bg-gradient-to-b from-sky-50 to-white p-5 md:border-l md:border-t-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">Cosa fa</p>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-900">{scenario.outcome}</p>
                <div className="mt-6 space-y-2">
                  {["Capisce la richiesta", "Controlla le regole", "Chiude o passa al team"].map((item) => (
                    <div key={item} className="rounded-xl border border-sky-100 bg-white p-3 text-xs leading-5 text-slate-600">{item}</div>
                  ))}
                </div>
                <p className="mt-6 text-[10px] leading-5 text-slate-400">Nomi, orari e risposte sono esempi dimostrativi, non dati reali.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
