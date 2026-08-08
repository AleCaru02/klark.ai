import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Inbox, Loader2, Mail, Phone, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const statusLabels = {
  new: "Nuova",
  contacted: "Contattata",
  qualified: "Qualificata",
  closed: "Chiusa",
} as const;

type DemoRequestStatus = keyof typeof statusLabels;
type DemoRequest = {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string | null;
  sector: string;
  call_volume: string | null;
  main_goal: string;
  existing_number: boolean | null;
  notes: string | null;
  selected_plan: string | null;
  referral_code: string | null;
  source: string;
  consent: boolean;
  status: DemoRequestStatus;
  created_at: string;
  updated_at: string;
};

type ListResponse = { requests?: DemoRequest[] };
type UpdateResponse = { request?: { id: string; status: DemoRequestStatus; updated_at: string } };

export default function DemoRequests() {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DemoRequestStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<ListResponse>("admin-demo-requests", {
        body: { action: "list", limit: 200 },
      });
      if (invokeError) throw invokeError;
      setRequests(data?.requests ?? []);
    } catch (loadError) {
      console.error("Unable to load demo requests", loadError);
      setError("Non è stato possibile caricare le richieste demo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("it-IT");
    return requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!normalized) return true;
      return [item.company, item.contact_name, item.email, item.phone, item.sector, item.main_goal]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("it-IT").includes(normalized));
    });
  }, [query, requests, statusFilter]);

  const updateStatus = async (id: string, status: DemoRequestStatus) => {
    setUpdatingId(id);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<UpdateResponse>("admin-demo-requests", {
        body: { action: "update-status", id, status },
      });
      if (invokeError || !data?.request) throw invokeError ?? new Error("Update rejected");
      setRequests((current) => current.map((item) => item.id === id ? { ...item, status: data.request!.status, updated_at: data.request!.updated_at } : item));
    } catch (updateError) {
      console.error("Unable to update demo request", updateError);
      setError("Aggiornamento non riuscito. Riprova.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Acquisizione</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950">Richieste demo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Richieste inviate dal sito pubblico. I dati restano separati dai CRM dei tenant e sono accessibili soltanto all'amministrazione piattaforma.</p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Aggiorna
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca azienda, contatto, email o settore" className="pl-10" /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | DemoRequestStatus)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Filtra per stato">
          <option value="all">Tutti gli stati</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="flex min-h-60 items-center justify-center rounded-2xl border border-slate-200 bg-white" role="status"><Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-700" aria-hidden="true" /><span className="text-sm text-slate-600">Caricamento richieste…</span></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Inbox className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold text-slate-900">Nessuna richiesta trovata</h2><p className="mt-2 text-sm text-slate-500">Le nuove richieste inviate dal sito compariranno qui.</p></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" /><h2 className="truncate text-lg font-bold text-slate-950">{item.company}</h2></div>
                  <p className="mt-1 text-sm text-slate-600">{item.contact_name} · {item.sector}</p>
                </div>
                <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value as DemoRequestStatus)} disabled={updatingId === item.id} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700" aria-label={`Stato richiesta ${item.company}`}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <a href={`mailto:${item.email}`} className="flex items-center gap-2 rounded-xl bg-sky-50/70 p-3 text-sm text-sky-800 hover:bg-sky-100"><Mail className="h-4 w-4" aria-hidden="true" />{item.email}</a>
                {item.phone ? <a href={`tel:${item.phone}`} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 hover:bg-slate-100"><Phone className="h-4 w-4" aria-hidden="true" />{item.phone}</a> : <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-400">Telefono non indicato</div>}
              </div>

              <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Obiettivo</dt><dd className="mt-1 text-sm leading-6 text-slate-700">{item.main_goal}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Volume</dt><dd className="mt-1 text-sm leading-6 text-slate-700">{item.call_volume || "Non indicato"}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Numero esistente</dt><dd className="mt-1 text-sm text-slate-700">{item.existing_number === true ? "Sì" : item.existing_number === false ? "No" : "Non indicato"}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Piano selezionato</dt><dd className="mt-1 text-sm text-slate-700">{item.selected_plan || "Nessuno"}</dd></div>
              </dl>

              {item.notes ? <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Contesto</p><p className="mt-2 text-sm leading-6 text-slate-600">{item.notes}</p></div> : null}
              <p className="mt-4 text-xs text-slate-400">Ricevuta {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
