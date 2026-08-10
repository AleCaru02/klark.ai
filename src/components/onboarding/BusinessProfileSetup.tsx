import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BusinessProfileSetupProps {
  onCompleteChange: (complete: boolean) => void;
}

interface ProfileResponse {
  profile?: {
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
    business_phone_e164?: string | null;
    business_email?: string | null;
    website?: string | null;
    existing_phone_e164?: string | null;
    existing_line_type?: string | null;
    forwarding_preference?: string | null;
  } | null;
  settings?: {
    timezone?: string | null;
    language_voice?: string | null;
    availability_json?: unknown;
    booking_rules_json?: unknown;
    recording_opt_in?: boolean | null;
    do_not_contact_default?: boolean | null;
  } | null;
}

const e164 = /^\+[1-9]\d{7,14}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BusinessProfileSetup({ onCompleteChange }: BusinessProfileSetupProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("IT");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [language, setLanguage] = useState("it");
  const [existingPhone, setExistingPhone] = useState("");
  const [lineType, setLineType] = useState("unknown");
  const [forwarding, setForwarding] = useState("evaluate");
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<BusinessProfileSetupRuntime>({});

  const complete = useMemo(
    () => Boolean(
      addressLine1.trim() &&
      city.trim() &&
      province.trim() &&
      postalCode.trim() &&
      countryCode.trim() &&
      e164.test(businessPhone.trim()) &&
      emailPattern.test(businessEmail.trim()) &&
      timezone.trim() &&
      language.trim(),
    ),
    [addressLine1, businessEmail, businessPhone, city, countryCode, language, postalCode, province, timezone],
  );

  useEffect(() => onCompleteChange(complete), [complete, onCompleteChange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<BusinessProfileSetupResponse>("onboarding-config", {
        body: { action: "get" },
      });
      if (error) throw error;
      const profile = data?.profile;
      const settings = data?.settings;
      setAddressLine1(profile?.address_line1 ?? "");
      setAddressLine2(profile?.address_line2 ?? "");
      setCity(profile?.city ?? "");
      setProvince(profile?.province ?? "");
      setPostalCode(profile?.postal_code ?? "");
      setCountryCode(profile?.country_code ?? "IT");
      setBusinessPhone(profile?.business_phone_e164 ?? "");
      setBusinessEmail(profile?.business_email ?? "");
      setWebsite(profile?.website ?? "");
      setExistingPhone(profile?.existing_phone_e164 ?? "");
      setLineType(profile?.existing_line_type ?? "unknown");
      setForwarding(profile?.forwarding_preference ?? "evaluate");
      setTimezone(settings?.timezone ?? "Europe/Rome");
      setLanguage(settings?.language_voice ?? "it");
      setRuntimeSnapshot({
        availability_json: settings?.availability_json ?? {},
        booking_rules_json: settings?.booking_rules_json ?? {},
        recording_opt_in: settings?.recording_opt_in === true,
        do_not_contact_default: settings?.do_not_contact_default === true,
      });
    } catch {
      toast.error("Dati azienda non disponibili.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!complete) {
      toast.error("Completa indirizzo, contatti, timezone e lingua.");
      return;
    }
    if (existingPhone.trim() && !e164.test(existingPhone.trim())) {
      toast.error("Il numero esistente deve essere in formato E.164.");
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase.functions.invoke("onboarding-config", {
        body: {
          action: "save_profile",
          profile: {
            address_line1: addressLine1,
            address_line2: addressLine2,
            city,
            province,
            postal_code: postalCode,
            country_code: countryCode,
            business_phone_e164: businessPhone,
            business_email: businessEmail,
            website,
            existing_phone_e164: existingPhone,
            existing_line_type: lineType,
            forwarding_preference: forwarding,
          },
        },
      });
      if (profileError) throw profileError;

      const { error: runtimeError } = await supabase.functions.invoke("onboarding-config", {
        body: {
          action: "save_runtime",
          timezone,
          language_voice: language,
          ...runtimeSnapshot,
        },
      });
      if (runtimeError) throw runtimeError;
      toast.success("Dati azienda salvati");
    } catch {
      toast.error("Dati azienda non salvati.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin" />Caricamento dati azienda</div>;
  }

  return (
    <div className="space-y-5 rounded-xl border p-4 md:p-5">
      <div>
        <h3 className="font-semibold">Sede e contatti</h3>
        <p className="text-sm text-muted-foreground">Questi dati sono tenant-scoped e vengono riutilizzati da Voice, agenda e compliance.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Indirizzo *" id="business-address"><Input id="business-address" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} maxLength={240} /></Field>
        <Field label="Interno / dettaglio"><Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} maxLength={240} /></Field>
        <Field label="Città *"><Input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} /></Field>
        <Field label="Provincia *"><Input value={province} onChange={(event) => setProvince(event.target.value)} maxLength={120} /></Field>
        <Field label="CAP *"><Input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} maxLength={20} inputMode="numeric" /></Field>
        <Field label="Paese *">
          <Select value={countryCode} onValueChange={setCountryCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IT">Italia</SelectItem><SelectItem value="ES">Spagna</SelectItem><SelectItem value="FR">Francia</SelectItem><SelectItem value="DE">Germania</SelectItem><SelectItem value="GB">Regno Unito</SelectItem></SelectContent></Select>
        </Field>
        <Field label="Telefono attività *"><Input value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} placeholder="+390212345678" inputMode="tel" aria-invalid={Boolean(businessPhone && !e164.test(businessPhone.trim()))} /></Field>
        <Field label="Email attività *"><Input type="email" value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} maxLength={254} aria-invalid={Boolean(businessEmail && !emailPattern.test(businessEmail.trim()))} /></Field>
        <Field label="Sito web"><Input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={300} placeholder="https://" /></Field>
        <Field label="Timezone *">
          <Select value={timezone} onValueChange={setTimezone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Europe/Rome">Europe/Rome</SelectItem><SelectItem value="Atlantic/Canary">Atlantic/Canary</SelectItem><SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem><SelectItem value="Europe/London">Europe/London</SelectItem></SelectContent></Select>
        </Field>
        <Field label="Lingua principale *">
          <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="it">Italiano</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent></Select>
        </Field>
      </div>

      <div className="border-t pt-4 space-y-4">
        <div>
          <h4 className="font-medium">Numero già conosciuto dai clienti</h4>
          <p className="text-xs text-muted-foreground">Serve a valutare forwarding o altre configurazioni. Non implica portabilità o deviazione garantita.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Numero esistente"><Input value={existingPhone} onChange={(event) => setExistingPhone(event.target.value)} placeholder="+3902..." inputMode="tel" /></Field>
          <Field label="Tipo linea"><Select value={lineType} onValueChange={setLineType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Da verificare</SelectItem><SelectItem value="landline">Fisso</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="voip">VoIP</SelectItem><SelectItem value="pbx">Centralino/PBX</SelectItem></SelectContent></Select></Field>
          <Field label="Forwarding"><Select value={forwarding} onValueChange={setForwarding}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="evaluate">Da valutare</SelectItem><SelectItem value="none">Non previsto</SelectItem><SelectItem value="conditional">Condizionale se supportato</SelectItem><SelectItem value="always">Sempre, se supportato</SelectItem></SelectContent></Select></Field>
        </div>
      </div>

      <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !complete}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Salva dati azienda</Button></div>
    </div>
  );
}

interface BusinessProfileSetupRuntime {
  availability_json?: unknown;
  booking_rules_json?: unknown;
  recording_opt_in?: boolean;
  do_not_contact_default?: boolean;
}

type BusinessProfileSetupResponse = ProfileResponse;

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
