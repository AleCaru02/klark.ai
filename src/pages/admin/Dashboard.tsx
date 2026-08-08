import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Plus, Phone, MessageCircle, Calendar, MoreVertical, Ban, Play, Eye, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: "active" | "trial" | "suspended";
  createdAt: string;
}

const planLabels: Record<string, string> = {
  voice_start: "Voice Start",
  combo_start: "Combo Start",
  combo_pro: "Combo Pro",
};

const statusLabels: Record<string, string> = {
  active: "Attivo",
  trial: "Trial",
  suspended: "Sospeso",
};

export default function AdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      // Fetch tenants with their subscriptions
      const { data: tenantsData, error } = await supabase
        .from("tenants")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch subscriptions and profiles for each tenant
      const [subsRes, profilesRes] = await Promise.all([
        supabase.from("subscriptions").select("tenant_id, plan_code, status"),
        supabase.from("profiles").select("tenant_id, email"),
      ]);

      const subsMap = new Map<string, { plan_code: string; status: string }>();
      (subsRes.data || []).forEach((s) => {
        if (!subsMap.has(s.tenant_id) || s.status === "active") {
          subsMap.set(s.tenant_id, { plan_code: s.plan_code, status: s.status });
        }
      });

      const emailMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p) => {
        if (p.email && !emailMap.has(p.tenant_id)) {
          emailMap.set(p.tenant_id, p.email);
        }
      });

      const mapped: Tenant[] = (tenantsData || []).map((t) => {
        const sub = subsMap.get(t.id);
        return {
          id: t.id,
          name: t.name,
          email: emailMap.get(t.id) || "-",
          plan: sub?.plan_code || "combo_start",
          status: (sub?.status === "active" ? "active" : sub?.status === "trialing" ? "trial" : "suspended") as Tenant["status"],
          createdAt: t.created_at,
        };
      });

      setTenants(mapped);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSuspend = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setSuspendDialogOpen(true);
  };

  const confirmSuspend = async () => {
    if (!selectedTenant) return;
    const newStatus = selectedTenant.status === "suspended" ? "active" : "canceled";
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: newStatus })
      .eq("tenant_id", selectedTenant.id);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: selectedTenant.status === "suspended" ? "Tenant riattivato" : "Tenant sospeso",
        description: `${selectedTenant.name} aggiornato con successo`,
      });
      fetchTenants();
    }
    setSuspendDialogOpen(false);
    setSelectedTenant(null);
  };

  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const trialTenants = tenants.filter((t) => t.status === "trial").length;
  const suspendedTenants = tenants.filter((t) => t.status === "suspended").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Clienti</h1>
          <p className="text-muted-foreground">Gestisci i tenant ClerkAI</p>
        </div>
        <Button asChild>
          <Link to="/admin/create-user">
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Cliente
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-sm text-muted-foreground">Clienti Totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeTenants}</p>
                <p className="text-sm text-muted-foreground">Attivi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trialTenants}</p>
                <p className="text-sm text-muted-foreground">Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suspendedTenants}</p>
                <p className="text-sm text-muted-foreground">Sospesi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca cliente..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Sospesi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants List */}
      {filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nessun cliente trovato</p>
            <p className="text-sm mt-1">Crea il primo cliente dal pulsante sopra</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => (
            <Card key={tenant.id} className={cn("hover:shadow-md transition-shadow", tenant.status === "suspended" && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold",
                      tenant.status === "suspended" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                    )}>
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{tenant.name}</p>
                        <Badge variant="secondary">{planLabels[tenant.plan] || tenant.plan}</Badge>
                        <Badge variant={tenant.status === "active" ? "default" : tenant.status === "trial" ? "secondary" : "destructive"}>
                          {statusLabels[tenant.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{tenant.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-muted-foreground hidden md:block">
                      {new Date(tenant.createdAt).toLocaleDateString("it-IT")}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/tenants/${tenant.id}`}><Eye className="w-4 h-4 mr-2" />Dettagli</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSuspend(tenant)}
                          className={tenant.status === "suspended" ? "text-success" : "text-destructive"}>
                          {tenant.status === "suspended" ? <><Play className="w-4 h-4 mr-2" />Riattiva</> : <><Ban className="w-4 h-4 mr-2" />Sospendi</>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTenant?.status === "suspended" ? "Riattiva Tenant" : "Sospendi Tenant"}</DialogTitle>
            <DialogDescription>
              {selectedTenant?.status === "suspended"
                ? `Riattivare "${selectedTenant?.name}"?`
                : `Sospendere "${selectedTenant?.name}"? I servizi verranno disattivati.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>Annulla</Button>
            <Button variant={selectedTenant?.status === "suspended" ? "default" : "destructive"} onClick={confirmSuspend}>
              {selectedTenant?.status === "suspended" ? "Riattiva" : "Sospendi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
