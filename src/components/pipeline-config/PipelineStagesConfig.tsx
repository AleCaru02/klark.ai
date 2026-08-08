import { useState, useEffect } from "react";
import { useCRM, STAGE_TYPES, STAGE_TYPE_LABELS, type Stage, type StageType } from "@/hooks/useCRM";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  GripVertical, Plus, Trash2, Save, Loader2, AlertCircle, Check, Palette
} from "lucide-react";

const STAGE_COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
  "#EF4444", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

interface EditableStage {
  id: string;
  name: string;
  stage_type: StageType;
  color: string;
  position: number;
  is_active: boolean;
  isNew?: boolean;
}

export default function PipelineStagesConfig() {
  const { stages, pipeline, pipelineLoading } = useCRM();
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();

  const [editStages, setEditStages] = useState<EditableStage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (stages.length > 0) {
      setEditStages(stages.map(s => ({
        id: s.id,
        name: s.name,
        stage_type: s.stage_type as StageType,
        color: s.color,
        position: s.position,
        is_active: s.is_active,
      })));
      setHasChanges(false);
    }
  }, [stages]);

  const validationErrors = (): string[] => {
    const errors: string[] = [];
    const activeStages = editStages.filter(s => s.is_active);
    
    if (activeStages.length === 0) {
      errors.push("Devi avere almeno uno stage attivo");
    }

    const hasInitial = activeStages.some(s => s.stage_type === "new_lead");
    if (!hasInitial) {
      errors.push("Devi avere almeno uno stage di tipo 'Nuovo Lead' (stage iniziale)");
    }

    for (const s of editStages) {
      if (!s.name.trim()) errors.push("Ogni stage deve avere un nome");
      if (!s.stage_type) errors.push(`Lo stage "${s.name || '(senza nome)'}" non ha un tipo assegnato`);
    }

    const names = editStages.map(s => s.name.trim().toLowerCase());
    const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
    if (dupes.length > 0) errors.push("Non puoi avere stage con lo stesso nome");

    return [...new Set(errors)];
  };

  const updateStage = (index: number, updates: Partial<EditableStage>) => {
    setEditStages(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
    setHasChanges(true);
  };

  const addStage = () => {
    const newPos = editStages.length;
    setEditStages(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: "",
      stage_type: "nurturing" as StageType,
      color: STAGE_COLORS[newPos % STAGE_COLORS.length],
      position: newPos,
      is_active: true,
      isNew: true,
    }]);
    setHasChanges(true);
  };

  const removeStage = (index: number) => {
    setEditStages(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })));
    setHasChanges(true);
  };

  const moveStage = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= editStages.length) return;
    setEditStages(prev => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy.map((s, i) => ({ ...s, position: i }));
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    const errors = validationErrors();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    if (!tenantId || !pipeline) return;

    setIsSaving(true);
    try {
      // Delete removed stages (only existing ones)
      const existingIds = stages.map(s => s.id);
      const keptIds = editStages.filter(s => !s.isNew).map(s => s.id);
      const deletedIds = existingIds.filter(id => !keptIds.includes(id));

      for (const id of deletedIds) {
        // Move contacts off deleted stage first
        const firstStage = editStages[0];
        if (firstStage && !firstStage.isNew) {
          await supabase.from("contact_stages").update({ stage_id: firstStage.id }).eq("stage_id", id);
        }
        await supabase.from("stages").delete().eq("id", id);
      }

      // Upsert stages
      for (const s of editStages) {
        if (s.isNew) {
          await supabase.from("stages").insert({
            pipeline_id: pipeline.id,
            tenant_id: tenantId,
            name: s.name.trim(),
            stage_type: s.stage_type,
            color: s.color,
            position: s.position,
            is_active: s.is_active,
          });
        } else {
          await supabase.from("stages").update({
            name: s.name.trim(),
            stage_type: s.stage_type,
            color: s.color,
            position: s.position,
            is_active: s.is_active,
          }).eq("id", s.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["crm-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      setHasChanges(false);
      toast.success("Pipeline salvata");
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (pipelineLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const errors = validationErrors();

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Stadi della Pipeline</CardTitle>
          <CardDescription>
            Definisci gli stadi attraverso cui passano i tuoi contatti. Ogni stadio deve avere un tipo logico che il sistema usa per le automazioni.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editStages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              {/* Position controls */}
              <div className="flex flex-col gap-1 pt-1">
                <button
                  onClick={() => moveStage(index, -1)}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground rotate-180" />
                </button>
                <span className="text-xs text-muted-foreground text-center">{index + 1}</span>
                <button
                  onClick={() => moveStage(index, 1)}
                  disabled={index === editStages.length - 1}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Color indicator */}
              <div className="pt-2">
                <div
                  className="w-5 h-5 rounded-full border-2 border-background shadow-sm cursor-pointer"
                  style={{ backgroundColor: stage.color }}
                  onClick={() => {
                    const currentIdx = STAGE_COLORS.indexOf(stage.color);
                    const nextColor = STAGE_COLORS[(currentIdx + 1) % STAGE_COLORS.length];
                    updateStage(index, { color: nextColor });
                  }}
                  title="Clicca per cambiare colore"
                />
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={stage.name}
                    onChange={e => updateStage(index, { name: e.target.value })}
                    placeholder="Es. Nuovo Lead"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo logico</Label>
                  <Select
                    value={stage.stage_type}
                    onValueChange={v => updateStage(index, { stage_type: v as StageType })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_TYPES.map(st => (
                        <SelectItem key={st} value={st}>
                          {STAGE_TYPE_LABELS[st]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive mt-1"
                onClick={() => removeStage(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addStage} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Aggiungi Stadio
          </Button>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {errors.length > 0 && hasChanges && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 space-y-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {err}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving || errors.length > 0}
          size="lg"
          className="gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salva Pipeline
        </Button>
      </div>
    </div>
  );
}
