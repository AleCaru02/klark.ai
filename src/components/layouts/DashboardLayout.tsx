import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  CreditCard,
  FileCheck2,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Phone,
  Puzzle,
  Settings,
  ShieldAlert,
  Sparkles,
  TestTube,
  UserRoundCheck,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/app/automation-studio", icon: Workflow, label: "Automation Studio" },
  { to: "/app/site-chatbot", icon: Bot, label: "Chatbot sito" },
  { to: "/app/service-value", icon: BarChart3, label: "Valore del servizio" },
  { to: "/app/handoffs", icon: UserRoundCheck, label: "Passaggi umani" },
  { to: "/app/quality", icon: ShieldAlert, label: "Qualità e incidenti" },
  { to: "/app/knowledge-governance", icon: FileCheck2, label: "Governance conoscenza" },
  { to: "/app/crm", icon: Kanban, label: "CRM" },
  { to: "/app/calendar", icon: Calendar, label: "Calendario" },
  { to: "/app/secretary", icon: Phone, label: "Segretaria" },
  { to: "/app/whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { to: "/app/training", icon: Sparkles, label: "Addestramento AI" },
  { to: "/app/logs", icon: FileText, label: "Log chiamate" },
  { to: "/app/tests", icon: TestTube, label: "Test Center" },
  { to: "/app/integrations", icon: Puzzle, label: "Integrazioni" },
  { to: "/app/pipeline-config", icon: Settings, label: "Pipeline CRM" },
  { to: "/app/billing", icon: CreditCard, label: "Fatturazione" },
  { to: "/app/referral", icon: Users, label: "Referral Network" },
  { to: "/app/settings", icon: Building2, label: "Impostazioni" },
];

function NoMembershipView({ user, onSignOut }: { user: { email?: string | null } | null; onSignOut: () => void }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" aria-hidden="true" />
          </div>
          <CardTitle>Account in attesa di attivazione</CardTitle>
          <CardDescription className="text-base">Il tuo account esiste, ma non è ancora associato a un'organizzazione.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-1">Email: {user?.email || "non disponibile"}</p>
            <p className="text-muted-foreground">Contatta l'amministratore per completare l'assegnazione. Nessun dato cliente è accessibile finché il tenant non è associato.</p>
          </div>
          <Button variant="outline" className="w-full" onClick={onSignOut}><LogOut className="w-4 h-4 mr-2" aria-hidden="true" />Esci</Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function DashboardLayout() {
  const { user, signOut, isAdmin, membership, isLoading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento area cliente…</p>
        </div>
      </div>
    );
  }

  if (user && !membership && !isAdmin) return <NoMembershipView user={user} onSignOut={handleSignOut} />;

  return (
    <div className="min-h-screen bg-background flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow-lg">Vai al contenuto principale</a>

      <aside
        id="dashboard-navigation"
        aria-label="Navigazione area cliente"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <Link to="/" className="flex items-center gap-2" aria-label="Torna alla home">
              <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center"><Phone className="w-4 h-4 text-primary-foreground" aria-hidden="true" /></div>
              <span className="font-bold text-foreground">Clerk<span className="text-gradient">AI</span></span>
            </Link>
            <button type="button" className="lg:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu"><X className="w-5 h-5" aria-hidden="true" /></button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Sezioni account">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />{item.label}
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2"><span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amministrazione piattaforma</span></div>
                <NavLink
                  to="/admin"
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Settings className="w-5 h-5" aria-hidden="true" />Pannello amministratore
                </NavLink>
              </>
            )}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true"><span className="text-sm font-semibold text-primary">{user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}</span></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user?.user_metadata?.full_name || "Utente"}</p><p className="text-xs text-muted-foreground truncate">{user?.email}</p></div>
            </div>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" aria-hidden="true" />Esci</Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button type="button" className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu laterale" />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:hidden">
          <button type="button" className="p-2 rounded-lg hover:bg-muted" onClick={() => setSidebarOpen(true)} aria-label="Apri menu" aria-expanded={sidebarOpen} aria-controls="dashboard-navigation"><Menu className="w-5 h-5" aria-hidden="true" /></button>
          <span className="font-bold" aria-label="ClerkAI">Clerk<span className="text-gradient">AI</span></span>
          <NotificationCenter />
        </header>
        <header className="h-14 border-b border-border bg-card hidden lg:flex items-center justify-end px-6 gap-3"><NotificationCenter /></header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 lg:p-8 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
