import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Headphones, PhoneCall, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

const sectors = [
  "Ecommerce",
  "Hotel / B&B / struttura ricettiva",
  "Property management",
  "Ristorante",
  "Centro estetico / parrucchiere",
  "Studio medico / clinica",
  "Studio legale / professionale",
  "Agenzia immobiliare",
  "Officina / concessionaria",
  "Palestra / centro sportivo",
  "Assistenza clienti",
  "Altro",
] as const;

const sectorFromQuery: Record<string, string> = {
  "hotel-strutture-ricettive": "Hotel / B&B / struttura ricettiva",
  "gestione-immobiliare": "Property management",
  ristoranti: "Ristorante",
  "centri-estetici-parrucchieri": "Centro estetico / parrucchiere",
  "studi-sanitari": "Studio medico / clinica",
  "studi-professionali": "Studio legale / professionale",
  "agenzie-immobiliari": "Agenzia immobiliare",
};

const volumes = ["Fino a 20 chiamate a settimana", "21–100 chiamate a settimana", "Oltre 100 chiamate a settimana", "Non lo so ancora"] as const;
const goals = [
  "Rispondere quando il personale è occupato",
  "Gestire appuntamenti",
  "Coprire fuori orario",
  "Rispondere alle domande frequenti",
  "Qualificare richieste e lead",
  "Ridurre interruzioni durante il lavoro",
  "Valutare più casi insieme",
] as const;

type FormState = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  sector: string;
  callVolume: string;
  mainGoal: string;
  existingNumber: string;
  notes: string;
  website: string;
  consent: boolean;
};

function makeInitialForm(sector: string): FormState {
  return {
    company: "",
    contactName: "",
    email: "",
    phone: "",
    sector,
    callVolume: "",
    mainGoal: "",
    existingNumber: "",
    notes: "",
    website: "",
    consent: false,
  };
}

export default function ServiceAssessment() {
  const [searchParams] = useSearchParams();
  const requestedSector = searchParams.get("sector") || "";
  const preselectedSector = sectorFromQuery[requestedSector] || "";
  const [form, setForm] = useState<FormState>(() => makeInitialForm(preselectedSector));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const selectedPlan = searchParams.get("plan") || undefined;
  const referralCode = searchParams.get("ref") || undefined;
  const demoRequestReady = isSupabaseConfigured && import.meta.env.VITE_PUBLIC_DEMO_REQUEST_READY === "true";

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!demoRequestReady) {
      setError("La richiesta demo online non è ancora attiva. Puoi ascoltare la demo voce oppure contattarci dai riferimenti presenti nel sito.");
      return;
    }
    if (!form.company.trim() || !form.contactName.trim() || !form.email.trim() || !form.sector || !form.mainGoal || !form.consent) {
      setError("Compila tutti i campi obbligatori e conferma la presa visione della privacy.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Inserisci un indirizzo email valido.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: submitError } = await supabase.functions.invoke("public-demo-request", {
        body: {
          company: form.company,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          sector: form.sector,
          callVolume: form.callVolume,
          mainGoal: form.mainGoal,
          existingNumber: form.existingNumber === "yes" ? true : form.existingNumber === "no" ? false : null,
          notes: form.notes,
          website: form.website,
          consent: form.consent,
          selectedPlan,
          referralCode,
        },
      });
      if (submitError || !data?.ok) throw submitError ?? new Error("Request not accepted");
      setSubmitted(true);
      setForm(makeInitialForm(preselectedSector));
    } catch (submitError) {
      console.error("Demo request failed", submitError);
      setError("Non siamo riusciti a registrare la richiesta. Riprova tra poco.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-gradient-to-b from-sky-50 via-white to-white" aria-hidden="true" />
        <div className="marketing-container">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div className="max-w-xl lg:sticky lg:top-28">
              <span className="marketing-eyebrow">Richiedi una demo</span>
              <h1 className="marketing-heading mt-5">Raccontaci come gestisci le chiamate. Ti mostriamo <span className="text-primary">come potrebbe funzionare sul tuo caso.</span></h1>
              <p className="marketing-lead mt-6">Bastano poche informazioni operative. Non devi conoscere strumenti tecnici o cambiare numero prima di capire se il servizio è adatto alla tua attività.</p>

              <div className="mt-8 space-y-3">
                {[
                  { icon: PhoneCall, title: "Partiamo dalle chiamate reali", text: "Orari, richieste frequenti, appuntamenti e momenti in cui oggi non riesci a rispondere." },
                  { icon: ShieldCheck, title: "Nessuna compatibilità data per scontata", text: "Numero esistente, agenda e altri collegamenti vengono verificati prima di essere promessi." },
                  { icon: UserRoundCheck, title: "Definiamo anche quando serve una persona", text: "La demo deve mostrare sia cosa può gestire la receptionist sia dove deve fermarsi." },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Icon className="h-4 w-4" aria-hidden="true" /></div>
                    <div><p className="text-sm font-bold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="mt-6 border-sky-200 bg-white" asChild><Link to="/#voice-demo"><Headphones className="h-4 w-4" aria-hidden="true" />Prima ascolta una chiamata</Link></Button>
            </div>

            <section className="rounded-[2rem] border border-sky-100 bg-white p-5 shadow-[0_24px_70px_rgba(14,165,233,0.09)] sm:p-7 lg:p-9" aria-labelledby="demo-form-title">
              {submitted ? (
                <div className="py-10 text-center" aria-live="polite">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></div>
                  <h2 id="demo-form-title" className="mt-5 text-2xl font-bold tracking-[-0.04em] text-slate-950">Richiesta registrata.</h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">Abbiamo salvato le informazioni che hai inviato. Verranno usate per valutare il flusso e preparare il contatto successivo.</p>
                  <Button className="mt-6" asChild><Link to="/">Torna alla homepage <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <div className="mb-7">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Informazioni essenziali</p>
                    <h2 id="demo-form-title" className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">La tua attività e il problema da risolvere</h2>
                    {selectedPlan ? <p className="mt-2 text-xs text-slate-500">Hai selezionato il piano <strong className="text-slate-700">{selectedPlan}</strong>. Lo useremo solo come contesto della richiesta.</p> : null}
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="company">Attività / azienda *</Label><Input id="company" autoComplete="organization" value={form.company} onChange={(e) => setField("company", e.target.value)} maxLength={160} required /></div>
                    <div className="space-y-2"><Label htmlFor="contactName">Nome e cognome *</Label><Input id="contactName" autoComplete="name" value={form.contactName} onChange={(e) => setField("contactName", e.target.value)} maxLength={120} required /></div>
                    <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setField("email", e.target.value)} maxLength={254} required /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Telefono</Label><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} maxLength={25} /></div>
                    <div className="space-y-2"><Label htmlFor="sector">Settore *</Label><select id="sector" value={form.sector} onChange={(e) => setField("sector", e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><option value="">Seleziona</option>{sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}</select></div>
                    <div className="space-y-2"><Label htmlFor="callVolume">Volume indicativo</Label><select id="callVolume" value={form.callVolume} onChange={(e) => setField("callVolume", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><option value="">Seleziona</option>{volumes.map((volume) => <option key={volume} value={volume}>{volume}</option>)}</select></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="mainGoal">Qual è il risultato principale che vuoi ottenere? *</Label><select id="mainGoal" value={form.mainGoal} onChange={(e) => setField("mainGoal", e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><option value="">Seleziona</option>{goals.map((goal) => <option key={goal} value={goal}>{goal}</option>)}</select></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="existingNumber">Hai già un numero aziendale che vuoi continuare a usare?</Label><select id="existingNumber" value={form.existingNumber} onChange={(e) => setField("existingNumber", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><option value="">Non specificato</option><option value="yes">Sì</option><option value="no">No</option></select><p className="text-xs leading-5 text-slate-500">La compatibilità viene verificata: non promettiamo automaticamente portabilità o inoltro per ogni linea.</p></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Cosa succede oggi quando non riesci a rispondere?</Label><Textarea id="notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} maxLength={1500} rows={5} placeholder="Esempio: durante i trattamenti non possiamo rispondere, dopo le 19 arrivano richieste, molti clienti chiedono sempre le stesse informazioni..." /></div>
                  </div>

                  <div className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><Label htmlFor="website">Sito web</Label><Input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setField("website", e.target.value)} /></div>

                  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    <input type="checkbox" checked={form.consent} onChange={(e) => setField("consent", e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                    <span>Ho letto l'<Link to="/privacy" className="font-semibold text-sky-700 underline underline-offset-2">informativa privacy</Link> e autorizzo l'uso dei dati inviati per gestire questa richiesta. *</span>
                  </label>

                  {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
                  {!demoRequestReady ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Il modulo online non è ancora attivo: il backend deve essere distribuito e verificato prima di accettare richieste reali. Nel frattempo puoi ascoltare la demo voce o usare i contatti presenti nel sito.</div> : null}

                  <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting || !demoRequestReady}>
                    {submitting ? "Invio in corso..." : "Richiedi la demo"}
                    {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                  <p className="mt-3 text-center text-xs leading-5 text-slate-500">Nessun pagamento online. La richiesta serve a valutare configurazione, numero e flusso prima di qualsiasi attivazione.</p>
                </form>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
