import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ServicesFaqSetupProps {
  onCompleteChange: (complete: boolean) => void;
}

interface ServiceDraft {
  name: string;
  description: string;
  duration_minutes: string;
  price_eur: string;
  disclose_price: boolean;
  appointment_enabled: boolean;
}

interface FaqDraft {
  question: string;
  answer: string;
}

interface LoadResponse {
  services?: Array<{
    name?: string;
    description?: string | null;
    duration_minutes?: number | null;
    price_cents?: number | null;
    disclose_price?: boolean;
    appointment_enabled?: boolean;
  }>;
  faqs?: Array<{ question?: string; answer?: string }>;
}

const blankService = (): ServiceDraft => ({
  name: "",
  description: "",
  duration_minutes: "30",
  price_eur: "",
  disclose_price: false,
  appointment_enabled: false,
});
const blankFaq = (): FaqDraft => ({ question: "", answer: "" });

export function ServicesFaqSetup({ onCompleteChange }: ServicesFaqSetupProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [faqs, setFaqs] = useState<FaqDraft[]>([]);

  const complete = useMemo(
    () => services.some((service) => service.name.trim().length > 0),
    [services],
  );

  useEffect(() => onCompleteChange(complete), [complete, onCompleteChange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<LoadResponse>("onboarding-config", { body: { action: "get" } });
      if (error) throw error;
      setServices((data?.services ?? []).map((service) => ({
        name: service.name ?? "",
        description: service.description ?? "",
        duration_minutes: service.duration_minutes ? String(service.duration_minutes) : "",
        price_eur: service.price_cents === null || service.price_cents === undefined ? "" : (service.price_cents / 100).toFixed(2),
        disclose_price: service.disclose_price === true,
        appointment_enabled: service.appointment_enabled === true,
      })));
      setFaqs((data?.faqs ?? []).map((faq) => ({ question: faq.question ?? "", answer: faq.answer ?? "" })));
    } catch {
      toast.error("Catalogo servizi e FAQ non disponibile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateService = (index: number, patch: Partial<ServiceDraft>) => {
    setServices((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const updateFaq = (index: number, patch: Partial<FaqDraft>) => {
    setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const save = async () => {
    const cleanServices = services.filter((service) => service.name.trim());
    const incompleteFaq = faqs.some((faq) => Boolean(faq.question.trim()) !== Boolean(faq.answer.trim()));
    if (!cleanServices.length) {
      toast.error("Aggiungi almeno un servizio offerto.");
      return;
    }
    if (incompleteFaq) {
      toast.error("Ogni FAQ deve avere sia domanda sia risposta.");
      return;
    }

    setSaving(true);
    try {
      const servicePayload = cleanServices.map((service) => {
        const parsedPrice = service.price_eur.trim() ? Number(service.price_eur.replace(",", ".")) : null;
        return {
          name: service.name.trim(),
          description: service.description.trim(),
          duration_minutes: service.duration_minutes ? Number(service.duration_minutes) : null,
          price_cents: parsedPrice === null || !Number.isFinite(parsedPrice) ? null : Math.max(0, Math.round(parsedPrice * 100)),
          disclose_price: service.disclose_price && parsedPrice !== null,
          appointment_enabled: service.appointment_enabled,
          is_active: true,
        };
      });
      const faqPayload = faqs.filter((faq) => faq.question.trim() && faq.answer.trim()).map((faq) => ({
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        is_active: true,
      }));

      const [serviceResult, faqResult] = await Promise.all([
        supabase.functions.invoke("onboarding-config", { body: { action: "replace_services", services: servicePayload } }),
        supabase.functions.invoke("onboarding-config", { body: { action: "replace_faqs", faqs: faqPayload } }),
      ]);
      if (serviceResult.error) throw serviceResult.error;
      if (faqResult.error) throw faqResult.error;
      toast.success("Servizi e FAQ salvati");
    } catch {
      toast.error("Servizi e FAQ non salvati.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin" />Caricamento servizi e FAQ</div>;

  return (
    <div className="space-y-6 rounded-xl border p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold">Servizi offerti</h3><p className="text-sm text-muted-foreground">Durata e prezzo sono strutturati. Il prezzo viene comunicato solo se abiliti l'opzione.</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => setServices((current) => [...current, blankService()])}><Plus className="w-4 h-4 mr-2" />Aggiungi servizio</Button>
      </div>

      {services.length === 0 ? <p className="text-sm text-muted-foreground">Nessun servizio configurato.</p> : null}
      <div className="space-y-4">
        {services.map((service, index) => (
          <div key={`service-${index}`} className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Servizio {index + 1}</span><Button type="button" variant="ghost" size="icon" onClick={() => setServices((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Rimuovi servizio ${index + 1}`}><Trash2 className="w-4 h-4" /></Button></div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nome *"><Input value={service.name} onChange={(event) => updateService(index, { name: event.target.value })} maxLength={160} /></Field>
              <Field label="Durata (minuti)"><Input type="number" min={5} max={1440} value={service.duration_minutes} onChange={(event) => updateService(index, { duration_minutes: event.target.value })} /></Field>
            </div>
            <Field label="Descrizione"><Textarea rows={2} value={service.description} onChange={(event) => updateService(index, { description: event.target.value })} maxLength={3000} /></Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Prezzo (€), opzionale"><Input inputMode="decimal" value={service.price_eur} onChange={(event) => updateService(index, { price_eur: event.target.value })} placeholder="0,00" /></Field>
              <div className="space-y-2 pt-1">
                <CheckRow checked={service.disclose_price} onChange={(checked) => updateService(index, { disclose_price: checked })} label="La receptionist può comunicare il prezzo" />
                <CheckRow checked={service.appointment_enabled} onChange={(checked) => updateService(index, { appointment_enabled: checked })} label="Servizio prenotabile in agenda" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold">FAQ</h3><p className="text-sm text-muted-foreground">Risposte approvate per le domande ricorrenti. Se la risposta non è qui o nella Knowledge Base, l'assistente deve dichiarare di non saperla.</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setFaqs((current) => [...current, blankFaq()])}><Plus className="w-4 h-4 mr-2" />Aggiungi FAQ</Button>
        </div>
        {faqs.map((faq, index) => (
          <div key={`faq-${index}`} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">FAQ {index + 1}</span><Button type="button" variant="ghost" size="icon" onClick={() => setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Rimuovi FAQ ${index + 1}`}><Trash2 className="w-4 h-4" /></Button></div>
            <Field label="Domanda"><Input value={faq.question} onChange={(event) => updateFaq(index, { question: event.target.value })} maxLength={500} /></Field>
            <Field label="Risposta approvata"><Textarea rows={3} value={faq.answer} onChange={(event) => updateFaq(index, { answer: event.target.value })} maxLength={5000} /></Field>
          </div>
        ))}
      </div>

      <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !complete}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Salva servizi e FAQ</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label className="flex items-start gap-2 text-sm cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
