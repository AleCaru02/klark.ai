import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, Phone, ServerOff } from "lucide-react";

const MIN_PASSWORD_LENGTH = 12;

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingLink, setIsCheckingLink] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsCheckingLink(false);
      return;
    }

    let mounted = true;
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    const hasRecoveryMarker =
      hashParams.get("type") === "recovery" ||
      queryParams.get("type") === "recovery" ||
      Boolean(queryParams.get("code"));

    if (hasRecoveryMarker) setIsRecovery(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      setIsCheckingLink(false);
    });

    const timeout = window.setTimeout(() => {
      if (mounted) setIsCheckingLink(false);
    }, 2_000);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => navigate("/login", { replace: true }), 2_000);
    return () => window.clearTimeout(timeout);
  }, [navigate, success]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured || !isRecovery) {
      setError("Il link non è valido oppure il backend non è configurato.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
      return;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Usa almeno una lettera minuscola, una maiuscola e un numero.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        console.error("Password update failed");
        setError("Non è stato possibile aggiornare la password. Richiedi un nuovo link.");
        return;
      }
      setSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <ServerOff className="w-12 h-12 text-amber-600 mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold">Reimpostazione non disponibile</h1>
          <p className="text-muted-foreground text-sm">
            Il backend di questa preview non è configurato. Nessuna password può essere modificata.
          </p>
          <Button onClick={() => navigate("/login")}>Torna al login</Button>
        </div>
      </main>
    );
  }

  if (isCheckingLink) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4" role="status" aria-live="polite">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifica del link…</p>
        </div>
      </main>
    );
  }

  if (!isRecovery && !success) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold">Link non valido</h1>
          <p className="text-muted-foreground text-sm">
            Il link di reimpostazione non è valido, è già stato usato oppure è scaduto.
          </p>
          <Button onClick={() => navigate("/forgot-password")}>Richiedi un nuovo link</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-primary">
            <Phone className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Clerk<span className="text-gradient">AI</span>
          </span>
        </div>

        {success ? (
          <div className="text-center space-y-4" role="status" aria-live="polite">
            <CheckCircle className="w-12 h-12 text-success mx-auto" aria-hidden="true" />
            <h1 className="text-xl font-bold">Password aggiornata</h1>
            <p className="text-muted-foreground text-sm">Reindirizzamento al login in corso…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2 text-center">Nuova password</h1>
            <p className="text-muted-foreground text-center mb-8">
              Usa almeno {MIN_PASSWORD_LENGTH} caratteri, una maiuscola, una minuscola e un numero.
            </p>

            {error && (
              <div
                className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset disabled={isLoading} className="space-y-4 disabled:opacity-60">
                <div className="space-y-2">
                  <Label htmlFor="password">Nuova password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Conferma password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="pl-10"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  {isLoading ? "Aggiornamento…" : "Aggiorna password"}
                </Button>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
