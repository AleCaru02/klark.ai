import { useState } from "react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, CheckCircle, Mail, Phone, ServerOff } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Il recupero password è temporaneamente non disponibile. Riprova tra poco.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        console.error("Password reset request failed");
        setError("Non è stato possibile inviare il link. Riprova oppure contatta il supporto.");
        return;
      }

      // La risposta resta identica anche quando l'indirizzo non esiste.
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Torna al login
        </Link>

        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-primary">
            <Phone className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Clerk<span className="text-gradient">AI</span>
          </span>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3" role="status">
            <ServerOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm">Il recupero password è temporaneamente non disponibile.</p>
          </div>
        )}

        {sent ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <CheckCircle className="w-12 h-12 text-success" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Controlla la tua email</h1>
            <p className="text-muted-foreground">
              Se l'indirizzo indicato è associato a un account ClerkAI, riceverai un link per scegliere una nuova password.
            </p>
            <p className="text-sm text-muted-foreground">Controlla anche la cartella spam o posta indesiderata.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Password dimenticata?</h1>
            <p className="text-muted-foreground mb-8">
              Inserisci l'email associata al tuo account ClerkAI. Ti invieremo le istruzioni per impostare una nuova password.
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
              <fieldset disabled={!isSupabaseConfigured || isLoading} className="space-y-4 disabled:opacity-60">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="nome@azienda.it"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  {isLoading ? "Invio in corso..." : "Invia link per nuova password"}
                </Button>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
