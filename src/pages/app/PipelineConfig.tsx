import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kanban, Bot } from "lucide-react";
import PipelineStagesConfig from "@/components/pipeline-config/PipelineStagesConfig";
import AutomationConfig from "@/components/pipeline-config/AutomationConfig";
import { FeatureGate } from "@/components/billing/FeatureGate";

export default function PipelineConfig() {
  return (
    <FeatureGate feature="crm_advanced_enabled" title="Configurazione Pipeline" description="Personalizza gli stadi del CRM e le automazioni. Disponibile con il piano Full.">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurazione Pipeline</h1>
        <p className="text-muted-foreground">
          Personalizza gli stadi del CRM e le automazioni del tuo processo commerciale
        </p>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-2">
            <Kanban className="w-4 h-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Bot className="w-4 h-4" />
            Automazioni
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineStagesConfig />
        </TabsContent>

        <TabsContent value="automations">
          <AutomationConfig />
        </TabsContent>
      </Tabs>
    </div>
    </FeatureGate>
  );
}
