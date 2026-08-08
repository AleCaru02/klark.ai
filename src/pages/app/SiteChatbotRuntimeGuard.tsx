import { AlertTriangle, CheckCircle2, ExternalLink, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SiteChatbot from "./SiteChatbot";

const runtimeVerified = import.meta.env.VITE_SITE_CHAT_RUNTIME_VERIFIED === "true";

export default function SiteChatbotRuntimeGuard() {
  if (runtimeVerified) return <SiteChatbot />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Badge variant="secondary" className="mb-3">Fail-closed</Badge>
        <h1 className="text-2xl font-bold">Chatbot del sito</h1>
        <p className="text-muted-foreground mt-1">
          La configurazione è stata installata, ma l'attivazione resta bloccata finché il runtime server non viene verificato.
        </p>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />
            Edge Functions non ancora verificate
          </CardTitle>
          <CardDescription>
            Il codice frontend e il database sono presenti, ma un chatbot non deve essere attivabile finché gli endpoint pubblici e i segreti server non superano un test reale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Requirement label="site-chat-bootstrap distribuita" passed={false} />
            <Requirement label="site-chat-message distribuita" passed={false} />
            <Requirement label="OPENAI_API_KEY configurata" passed={false} />
            <Requirement label="Segreti HMAC configurati" passed={false} />
            <Requirement label="Test origine autorizzata" passed={false} />
            <Requirement label="Test isolamento tra tenant" passed={false} />
          </div>
          <div className="rounded-xl border bg-background p-4 flex items-start gap-3 text-sm">
            <Server className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Condizione per lo sblocco</p>
              <p className="text-muted-foreground mt-1">
                Impostare <code>VITE_SITE_CHAT_RUNTIME_VERIFIED=true</code> soltanto dopo che gli endpoint rispondono, i limiti sono attivi e un test Tenant A/Tenant B è stato superato.
              </p>
            </div>
          </div>
          <a
            href="/app/knowledge-governance"
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            Prepara intanto le fonti approvate
            <ExternalLink className="w-4 h-4 ml-1" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

function Requirement({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="rounded-lg border bg-background p-3 flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}
