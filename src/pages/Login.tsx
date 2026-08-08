import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthLandingRoute, useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, ServerOff, ShieldCheck } from "lucide-react";
import { product } from "@/config/product";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, backendConfigured, user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) navigate(getAuthLandingRoute(isAdmin), { replace: true });
  }, [authLoading, isAdmin, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!backendConfigured) { setError("Accesso non disponibile: il backend non è configurato."); return; }
    setIsSubmitting(true);
    try {
      const { error: signInError, destination } = await signIn(email.trim(), password);
      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) setError("Email o password non corretti.");
        else if (signInError.message.includes("Email not confirmed")) setError("Email non confermata. Controlla la tua casella di posta.");
        else if (signInError.message.includes("backend")) setError(signInError.message);
        else setError("Accesso non riuscito. Riprova oppure contatta il supporto.");
        return;
      }
      if (destination) navigate(destination, { replace: true });
    } finally { setIsSubmitting(false); }
  };

  const busy = isSubmitting || authLoading;

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      <section className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-16 xl:px-24" aria-labelledby="login-title">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Torna al sito</Link>
          <div className="mb-8 flex items-center gap-2.5"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 shadow-sm"><Phone className="h-5 w-5" aria-hidden="true" /></div><span className="text-xl font-bold text-slate-950">{product.name}</span></div>
          <div className="mb-8"><h1 id="login-title" className="mb-2 text-2xl font-bold text-slate-950">Accedi al tuo account</h1><p className="text-slate-600">Inserisci email e password. Dopo l'accesso verrai portato automaticamente nella tua area.</p></div>

          {!backendConfigured && <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status"><ServerOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" /><div><p className="text-sm font-medium text-slate-900">Accesso temporaneamente non disponibile</p><p className="mt-1 text-xs text-slate-500">Il sito pubblico resta consultabile.</p></div></div>}
          {error && <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4" role="alert"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" /><p className="text-sm text-red-700">{error}</p></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={!backendConfigured || busy} className="space-y-4 disabled:opacity-60">
              <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="nome@azienda.it" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" required autoFocus /></div></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10 pr-10" required minLength={8} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-800" aria-label={showPassword ? "Nascondi password" : "Mostra password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div className="flex justify-end"><Link to="/forgot-password" className="text-sm text-sky-700 hover:underline">Password dimenticata?</Link></div>
              <Button type="submit" className="w-full" size="lg">{busy ? "Accesso in corso..." : "Accedi"}</Button>
            </fieldset>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" /><p className="text-xs leading-relaxed text-slate-600">L'area amministratore e l'area cliente sono separate in base ai permessi dell'account. Non è prevista registrazione pubblica.</p></div>
        </div>
      </section>

      <aside className="hidden min-h-screen items-center justify-center border-l border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-12 lg:flex" aria-hidden="true">
        <div className="max-w-md rounded-[2rem] border border-sky-100 bg-white p-8 shadow-[0_24px_70px_rgba(14,165,233,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Area riservata</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-slate-950">Un solo accesso. La dashboard corretta.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">I clienti entrano nella propria area operativa. Gli amministratori della piattaforma accedono direttamente alla gestione autorizzata.</p>
          <div className="mt-6 space-y-2.5">{["Permessi verificati dal backend", "Area cliente e piattaforma separate", "Nessuna registrazione pubblica"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-sky-50/70 p-3 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{item}</div>)}</div>
        </div>
      </aside>
    </main>
  );
}
