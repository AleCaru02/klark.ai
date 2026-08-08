import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const NOTICE_KEY = "technical-storage-notice-v1";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(NOTICE_KEY)) {
      const timer = window.setTimeout(() => setVisible(true), 800);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(NOTICE_KEY, "dismissed");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-fade-in">
      <div className="container mx-auto max-w-4xl">
        <div className="relative bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1 pr-7 md:pr-0">
            <p className="text-sm font-medium mb-1">Tecnologie necessarie</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Il sito e l'area riservata possono usare memoria locale e tecnologie necessarie per sessione, sicurezza e preferenze. Non viene richiesto un consenso generico per strumenti analitici che non risultano ancora configurati.{" "}
              <Link to="/cookies" className="text-primary hover:underline">Dettagli</Link>
            </p>
          </div>
          <Button size="sm" onClick={dismiss} className="shrink-0">Ho capito</Button>
          <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label="Chiudi informativa">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
