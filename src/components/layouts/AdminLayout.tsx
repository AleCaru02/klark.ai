import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, CalendarCheck, FlaskConical, Inbox, LogOut, Menu, Phone, Settings, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { to: "/admin", icon: Users, label: "Organizzazioni", end: true },
  { to: "/admin/demo-requests", icon: Inbox, label: "Richieste demo" },
  { to: "/admin/provisioning", icon: Phone, label: "Numeri telefonici" },
  { to: "/admin/create-user", icon: UserPlus, label: "Crea utente" },
  { to: "/admin/usage", icon: BarChart3, label: "Consumi" },
  { to: "/admin/appointments", icon: CalendarCheck, label: "Appuntamenti" },
  { to: "/admin/tests", icon: FlaskConical, label: "Test di sistema" },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-slate-50/60">
      <a href="#admin-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg">Vai al contenuto amministrativo</a>

      <aside id="admin-navigation" aria-label="Navigazione amministrazione piattaforma" className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-sky-100 bg-white text-slate-800 shadow-[8px_0_30px_rgba(14,165,233,0.04)] transition-transform duration-200 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Settings className="h-4 w-4" aria-hidden="true" /></div><span className="font-bold text-slate-950">Amministrazione</span></div>
            <button type="button" className="rounded-lg p-2 hover:bg-sky-50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu amministrazione"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>

          <div className="border-b border-slate-200 p-4"><Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-sky-50 hover:text-sky-800" onClick={() => navigate("/app")}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Torna all'area cliente</Button></div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Sezioni amministrative">
            {adminNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-sky-50 text-sky-800 ring-1 ring-sky-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
              )} onClick={() => setSidebarOpen(false)}><item.icon className="h-5 w-5" aria-hidden="true" />{item.label}</NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-700" aria-hidden="true"><span className="text-sm font-semibold">{user?.email?.charAt(0).toUpperCase() || "A"}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">Amministratore piattaforma</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div></div>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-50" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" aria-hidden="true" />Esci</Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu amministrazione" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden"><button type="button" className="rounded-lg p-2 hover:bg-sky-50" onClick={() => setSidebarOpen(true)} aria-label="Apri menu amministrazione" aria-expanded={sidebarOpen} aria-controls="admin-navigation"><Menu className="h-5 w-5" aria-hidden="true" /></button><span className="font-bold text-slate-950">Amministrazione</span><div className="w-9" aria-hidden="true" /></header>
        <main id="admin-main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
