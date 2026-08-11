import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceOperationsSetupProps {
  onCompleteChange: (complete: boolean) => void;
}

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
interface DayHours { enabled: boolean; start: string; end: string }
interface ExceptionDraft { exception_date: string; is_closed: boolean; start_time: string; end_time: string; note: string }
interface ProfileRecord {
  address_line1?: string | null; address_line2?: string | null; city?: string | null; province?: string | null; postal_code?: string | null;
  country_code?: string | null; business_phone_e164?: string | null; business_email?: string | null; website?: string | null;
  existing_phone_e164?: string | null; existing_line_type?: string | null; forwarding_preference?: string | null;
  callback_policy?: string | null; escalation_policy?: string | null; outside_hours_behavior?: string | null;
  ai_disclosure_confirmed?: boolean; callback_consent_required?: boolean; dnc_respected?: boolean;
}
interface LoadResponse {
  profile?: ProfileRecord | null;
  settings?: {
    timezone?: string | null; language_voice?: string | null; availability_json?: Record<string, { start?: string; end?: string }> | null;
    booking_rules_json?: Record<string, number> | null; recording_opt_in?: boolean | null; do_not_contact_default?: boolean | null;
  } | null;
  exceptions?: Array<{ exception_date?: string; is_closed?: boolean; start_time?: string | null; end_time?: string | null; note?: string | null }>;
}

const days: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Lunedì" }, { key: "tuesday", label: "Martedì" }, { key: "wednesday", label: "Mercoledì" },
  { key: "thursday", label: "Giovedì" }, { key: "friday", label: "Venerdì" }, { key: "saturday", label: "Sabato" }, { key: "sunday", label: "Domenica" },
];

const defaultHours = (): Record<DayKey, DayHours> => ({
  monday: { enabled: true, start: "09:00", end: "18:00" }, tuesday: { enabled: true, start: "09:00", end: "18:00" },
  wednesday: { enabled: true, start: "09:00", end: "18:00" }, thursday: { enabled: true, start: "09:00", end: "18:00" },
  friday: { enabled: true, start: "09:00", end: "18:00" }, saturday: { enabled: false, start: "09:00", end: "13:00" },
  sunday: { enabled: false, start: "09:00", end: "13:00" },
});

export function VoiceOperationsSetup({ onCompleteChange }: VoiceOperationsSetupProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord>({});
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(defaultHours);
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>([]);
  const [slotDuration, setSlotDuration] = useState("30");
  const [bufferBefore, setBufferBefore] = useState("0");
  const [bufferAfter, setBufferAfter] = useState("0");
  const [minNotice, setMinNotice] = useState("24");
  const [maxAdvance, setMaxAdvance] = useState("30");
  const [callbackPolicy, setCallbackPolicy] = useState("");
  const [escalationPolicy, setEscalationPolicy] = useState("");
  const [outsideHours, setOutsideHours] = useState("");
  const [aiDisclosure, setAiDisclosure] = useState(false);
  const [callbackConsent, setCallbackConsent] = useState(true);
  const [dncRespected, setDncRespected] = useState(true);
  const [recordingOptIn, setRecordingOptIn] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [language, setLanguage] = useState("it");

  const complete = useMemo(() => Boolean(
    aiDisclosure && callbackConsent && dncRespected && callbackPolicy.trim() && escalationPolicy.trim() && outsideHours.trim()
      && days.some(({ key }) => hours[key].enabled)
      && Number(slotDuration) >= 5 && Number(maxAdvance) >= 1,
  ), [aiDisclosure, callbackConsent, callbackPolicy, dncRespected, escalationPolicy, hours, maxAdvance, outsideHours, slotDuration]);

  useEffect(() => onCompleteChange(complete), [complete, onCompleteChange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<LoadResponse>("onboarding-config", { body: { action: "get" } });
      if (error) throw error;
      const storedProfile = data?.profile ?? {};
      const storedSettings = data?.settings ?? {};
      setProfile(storedProfile);
      setCallbackPolicy(storedProfile.callback_policy ?? "");
      setEscalationPolicy(storedProfile.escalation_policy ?? "");
      setOutsideHours(storedProfile.outside_hours_behavior ?? "");
      setAiDisclosure(storedProfile.ai_disclosure_confirmed === true);
      setCallbackConsent(storedProfile.callback_consent_required !== false);
      setDncRespected(storedProfile.dnc_respected !== false);
      setRecordingOptIn(storedSettings.recording_opt_in === true);
      setTimezone(storedSettings.timezone ?? "Europe/Rome");
      setLanguage(storedSettings.language_voice ?? "it");

      const configured = storedSettings.availability_json ?? {};
      const nextHours = defaultHours();
      for (const { key } of days) {
        const value = configured[key];
        nextHours[key] = value
          ? { enabled: true, start: value.start ?? nextHours[key].start, end: value.end ?? nextHours[key].end }
          : { ...nextHours[key], enabled: false };
      }
      setHours(nextHours);

      const rules = storedSettings.booking_rules_json ?? {};
      setSlotDuration(String(rules.slot_duration_minutes ?? 30));
      setBufferBefore(String(rules.buffer_before_minutes ?? 0));
      setBufferAfter(String(rules.buffer_after_minutes ?? 0));
      setMinNotice(String(rules.min_notice_hours ?? 24));
      setMaxAdvance(String(rules.max_advance_days ?? 30));
      setExceptions((data?.exceptions ?? []).map((item) => ({
        exception_date: item.exception_date ?? "", is_closed: item.is_closed !== false,
        start_time: item.start_time?.slice(0, 5) ?? "09:00", end_time: item.end_time?.slice(0, 5) ?? "18:00", note: item.note ?? "",
      })));
    } catch {
      toast.error("Orari, agenda e compliance non disponibili.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!complete) {
      toast.error("Completa orari, policy di callback/escalation e conferme compliance.");
      return;
    }
    const availability: Record<string, { start: string; end: string }> = {};
    for (const { key } of days) if (hours[key].enabled) availability[key] = { start: hours[key].start, end: hours[key].end };

    setSaving(true);
    try {
      const results = await Promise.all([
        supabase.functions.invoke("onboarding-config", {
          body: {
            action: "save_profile",
            profile: {
              ...profile,
              callback_policy: callbackPolicy,
              escalation_policy: escalationPolicy,
              outside_hours_behavior: outsideHours,
              ai_disclosure_confirmed: aiDisclosure,
              callback_consent_required: callbackConsent,
              dnc_respected: dncRespected,
            },
          },
        }),
        supabase.functions.invoke("onboarding-config", {
          body: {
            action: "save_runtime", timezone, language_voice: language, availability_json: availability,
            booking_rules_json: {
              slot_duration_minutes: Number(slotDuration), buffer_before_minutes: Number(bufferBefore), buffer_after_minutes: Number(bufferAfter),
              min_notice_hours: Number(minNotice), max_advance_days: Number(maxAdvance),
            },
            recording_opt_in: recordingOptIn,
            do_not_contact_default: false,
          },
        }),
        supabase.functions.invoke("onboarding-config", { body: { action: "replace_exceptions", exceptions } }),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      toast.success("Orari, agenda e regole Voice salvati");
    } catch {
      toast.error("Configurazione operativa non salvata.");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin" />Caricamento configurazione operativa</div>;

  return (
    <div className="space-y-6 rounded-xl border p-4 md:p-5">
      <section className="space-y-4">
        <div><h3 className="font-semibold">Orari settimanali</h3><p className="text-sm text-muted-foreground">I giorni disattivati sono considerati chiusi. Le eccezioni hanno precedenza.</p></div>
        <div className="space-y-2">
          {days.map(({ key, label }) => {
            const day = hours[key];
            return <div key={key} className="grid grid-cols-[120px_1fr] md:grid-cols-[140px_1fr_1fr] gap-3 items-center rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={day.enabled} onChange={(event) => setHours((current) => ({ ...current, [key]: { ...current[key], enabled: event.target.checked } }))} />{label}</label>
              <Input type="time" value={day.start} disabled={!day.enabled} onChange={(event) => setHours((current) => ({ ...current, [key]: { ...current[key], start: event.target.value } }))} />
              <Input className="col-start-2 md:col-start-auto" type="time" value={day.end} disabled={!day.enabled} onChange={(event) => setHours((current) => ({ ...current, [key]: { ...current[key], end: event.target.value } }))} />
            </div>;
          })}
        </div>
      </section>

      <section className="border-t pt-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">Festività ed eccezioni</h3><p className="text-sm text-muted-foreground">Chiusure o orari speciali per data.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setExceptions((current) => [...current, { exception_date: "", is_closed: true, start_time: "09:00", end_time: "18:00", note: "" }])}><Plus className="w-4 h-4 mr-2" />Aggiungi eccezione</Button></div>
        {exceptions.map((item, index) => <div key={`exception-${index}`} className="grid md:grid-cols-[1fr_auto_1fr_1fr_2fr_auto] gap-2 items-end rounded-lg border p-3">
          <Field label="Data"><Input type="date" value={item.exception_date} onChange={(event) => patchException(index, { exception_date: event.target.value }, setExceptions)} /></Field>
          <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={item.is_closed} onChange={(event) => patchException(index, { is_closed: event.target.checked }, setExceptions)} />Chiuso</label>
          <Field label="Apre"><Input type="time" disabled={item.is_closed} value={item.start_time} onChange={(event) => patchException(index, { start_time: event.target.value }, setExceptions)} /></Field>
          <Field label="Chiude"><Input type="time" disabled={item.is_closed} value={item.end_time} onChange={(event) => patchException(index, { end_time: event.target.value }, setExceptions)} /></Field>
          <Field label="Nota"><Input value={item.note} onChange={(event) => patchException(index, { note: event.target.value }, setExceptions)} maxLength={500} /></Field>
          <Button type="button" variant="ghost" size="icon" onClick={() => setExceptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Rimuovi eccezione"><Trash2 className="w-4 h-4" /></Button>
        </div>)}
      </section>

      <section className="border-t pt-5 space-y-4">
        <div><h3 className="font-semibold">Agenda</h3><p className="text-sm text-muted-foreground">Regole usate dal flusso Voice quando la prenotazione diretta è abilitata.</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <NumberField label="Durata (min)" value={slotDuration} onChange={setSlotDuration} min={5} max={480} />
          <NumberField label="Buffer prima" value={bufferBefore} onChange={setBufferBefore} min={0} max={240} />
          <NumberField label="Buffer dopo" value={bufferAfter} onChange={setBufferAfter} min={0} max={240} />
          <NumberField label="Anticipo min (h)" value={minNotice} onChange={setMinNotice} min={0} max={720} />
          <NumberField label="Orizzonte (giorni)" value={maxAdvance} onChange={setMaxAdvance} min={1} max={730} />
        </div>
      </section>

      <section className="border-t pt-5 space-y-4">
        <div><h3 className="font-semibold">Telefonia, callback ed escalation</h3><p className="text-sm text-muted-foreground">Il numero ClerkAI viene assegnato dal provisioning. Qui definisci il comportamento, senza promettere portabilità o forwarding.</p></div>
        <Field label="Policy callback *"><Textarea rows={3} value={callbackPolicy} onChange={(event) => setCallbackPolicy(event.target.value)} maxLength={1500} placeholder="Quando è consentito richiamare, quale finestra usare e quando non richiamare." /></Field>
        <Field label="Escalation *"><Textarea rows={3} value={escalationPolicy} onChange={(event) => setEscalationPolicy(event.target.value)} maxLength={1500} placeholder="Quando trasferire o creare una richiesta per una persona." /></Field>
        <Field label="Fuori orario *"><Textarea rows={2} value={outsideHours} onChange={(event) => setOutsideHours(event.target.value)} maxLength={1000} placeholder="Esempio: raccogli la richiesta e proponi un richiamo nel primo orario utile." /></Field>
      </section>

      <section className="border-t pt-5 space-y-3">
        <div><h3 className="font-semibold">Regole e compliance</h3><p className="text-sm text-muted-foreground">La registrazione resta disattivata per impostazione predefinita e richiede un consenso separato.</p></div>
        <CheckRow checked={aiDisclosure} onChange={setAiDisclosure} label="Confermo che la receptionist deve dichiarare chiaramente di essere un assistente AI" />
        <CheckRow checked={callbackConsent} onChange={setCallbackConsent} label="Richiedi un consenso/permesso valido prima dei callback quando necessario" />
        <CheckRow checked={dncRespected} onChange={setDncRespected} label="Rispetta sempre Do Not Contact e revoche del consenso" />
        <CheckRow checked={recordingOptIn} onChange={setRecordingOptIn} label="Registrazione chiamate autorizzata per questo tenant (opzionale)" />
        <p className="text-xs text-muted-foreground">Lascia l'ultima opzione disattivata se non esiste una base e un'informativa adeguata. Il software non attiva Voice né una registrazione in questa schermata.</p>
      </section>

      <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !complete}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Salva configurazione operativa</Button></div>
    </div>
  );
}

function patchException(index: number, patch: Partial<ExceptionDraft>, setter: React.Dispatch<React.SetStateAction<ExceptionDraft[]>>) {
  setter((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function NumberField({ label, value, onChange, min, max }: { label: string; value: string; onChange: (value: string) => void; min: number; max: number }) { return <Field label={label}><Input type="number" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} /></Field>; }
function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) { return <label className="flex items-start gap-2 text-sm cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>; }
