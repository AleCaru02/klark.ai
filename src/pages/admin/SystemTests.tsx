import { useState, useEffect, useRef } from "react";
import {
  useSystemTests,
  createCoreTests,
  createAdvancedTests,
  TestStep,
  TestSuite,
} from "@/hooks/useSystemTests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  FlaskConical,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

type AutoRunPhase = "idle" | "resetting" | "running_core" | "running_advanced" | "completed";

function StatusBadge({ status }: { status: TestStep["status"] | TestSuite["status"] }) {
  switch (status) {
    case "pending":
    case "idle":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          In attesa
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          In esecuzione
        </Badge>
      );
    case "pass":
    case "done":
      return (
        <Badge className="gap-1 bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3" />
          {status === "pass" ? "PASS" : "Completato"}
        </Badge>
      );
    case "fail":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          FAIL
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          Saltato
        </Badge>
      );
    default:
      return null;
  }
}

function TestResultsTable({ suite }: { suite: TestSuite }) {
  const passCount = suite.steps.filter((s) => s.status === "pass").length;
  const failCount = suite.steps.filter((s) => s.status === "fail").length;
  const skippedCount = suite.steps.filter((s) => s.status === "skipped").length;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{suite.name}</CardTitle>
            <CardDescription>
              {passCount} passati, {failCount} falliti{skippedCount > 0 ? `, ${skippedCount} saltati` : ""}
            </CardDescription>
          </div>
          <StatusBadge status={suite.status} />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Step</TableHead>
                <TableHead className="w-[12%]">Stato</TableHead>
                <TableHead className="w-[10%]">Durata</TableHead>
                <TableHead>Dettagli</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suite.steps.map((step) => (
                <TableRow 
                  key={step.id}
                  className={step.status === "fail" ? "bg-destructive/10" : ""}
                >
                  <TableCell className="font-medium">{step.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={step.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {step.duration !== undefined ? `${step.duration}ms` : "-"}
                  </TableCell>
                  <TableCell 
                    className={`text-sm ${step.status === "fail" ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {step.status === "fail" && step.details ? (
                      <div className="max-w-md">
                        <div className="flex items-start gap-1">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="break-words whitespace-pre-wrap">{step.details}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="truncate block max-w-md">{step.details || "-"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function SystemTests() {
  const {
    suites,
    runTestSuite,
    resetTestData,
    resetStatus,
    resetDetails,
    clearResults,
  } = useSystemTests();

  const [isRunningCore, setIsRunningCore] = useState(false);
  const [isRunningAdvanced, setIsRunningAdvanced] = useState(false);
  const [autoRunPhase, setAutoRunPhase] = useState<AutoRunPhase>("idle");
  const [autoRunLog, setAutoRunLog] = useState<string[]>([]);
  const hasRunRef = useRef(false);

  // Auto-run on mount
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const runAutoTests = async () => {
      setAutoRunLog(["🚀 Avvio automatico test suite..."]);

      // Phase 1: Reset
      setAutoRunPhase("resetting");
      setAutoRunLog((prev) => [...prev, "🗑️ Reset dati di test..."]);
      
      const resetResult = await resetTestData();
      if (!resetResult.success) {
        setAutoRunLog((prev) => [...prev, `❌ Reset fallito: ${resetResult.error}`]);
        setAutoRunPhase("completed");
        return;
      }
      setAutoRunLog((prev) => [...prev, "✅ Reset completato"]);

      // Phase 2: Core tests
      setAutoRunPhase("running_core");
      setAutoRunLog((prev) => [...prev, "🧪 Esecuzione CORE TESTS..."]);
      setIsRunningCore(true);
      
      const coreTests = createCoreTests();
      const coreResults = await runTestSuite("Core Tests", coreTests);
      setIsRunningCore(false);

      const coreFailures = coreResults.filter((r) => r.status === "fail");
      const corePasses = coreResults.filter((r) => r.status === "pass");

      if (coreFailures.length > 0) {
        setAutoRunLog((prev) => [
          ...prev,
          `⚠️ CORE TESTS: ${corePasses.length} PASS, ${coreFailures.length} FAIL`,
          ...coreFailures.map((f) => `   ❌ ${f.name}: ${f.details}`),
          "⏹️ ADVANCED TESTS saltati a causa di errori CORE",
        ]);
        setAutoRunPhase("completed");
        toast.warning(`Core tests: ${coreFailures.length} falliti`);
        return;
      }

      setAutoRunLog((prev) => [...prev, `✅ CORE TESTS: tutti ${corePasses.length} passati`]);

      // Phase 3: Advanced tests (only if core passed)
      setAutoRunPhase("running_advanced");
      setAutoRunLog((prev) => [...prev, "🔬 Esecuzione ADVANCED TESTS..."]);
      setIsRunningAdvanced(true);
      
      const advancedTests = createAdvancedTests();
      const advancedResults = await runTestSuite("Advanced Tests", advancedTests);
      setIsRunningAdvanced(false);

      const advFailures = advancedResults.filter((r) => r.status === "fail");
      const advPasses = advancedResults.filter((r) => r.status === "pass");
      const advSkipped = advancedResults.filter((r) => r.status === "skipped");

      if (advFailures.length > 0) {
        setAutoRunLog((prev) => [
          ...prev,
          `⚠️ ADVANCED TESTS: ${advPasses.length} PASS, ${advFailures.length} FAIL, ${advSkipped.length} SKIPPED`,
          ...advFailures.map((f) => `   ❌ ${f.name}: ${f.details}`),
        ]);
        toast.warning(`Advanced tests: ${advFailures.length} falliti`);
      } else {
        setAutoRunLog((prev) => [
          ...prev,
          `✅ ADVANCED TESTS: tutti ${advPasses.length} passati${advSkipped.length > 0 ? `, ${advSkipped.length} saltati` : ""}`,
        ]);
        toast.success("Tutti i test passati! 🎉");
      }

      setAutoRunLog((prev) => [...prev, "🏁 Test suite completata"]);
      setAutoRunPhase("completed");
    };

    // Small delay to ensure component is mounted
    setTimeout(runAutoTests, 500);
  }, [resetTestData, runTestSuite]);

  const handleRunCoreTests = async () => {
    setIsRunningCore(true);
    toast.info("Avvio test core...");
    try {
      const coreTests = createCoreTests();
      const results = await runTestSuite("Core Tests", coreTests);
      const passed = results.filter((r) => r.status === "pass").length;
      const failed = results.filter((r) => r.status === "fail").length;
      
      if (failed === 0) {
        toast.success(`Tutti i ${passed} test core passati!`);
      } else {
        toast.warning(`${passed} passati, ${failed} falliti`);
      }
    } catch (error) {
      toast.error("Errore durante l'esecuzione dei test");
    } finally {
      setIsRunningCore(false);
    }
  };

  const handleRunAdvancedTests = async () => {
    setIsRunningAdvanced(true);
    toast.info("Avvio test avanzati...");
    try {
      const advancedTests = createAdvancedTests();
      const results = await runTestSuite("Advanced Tests", advancedTests);
      const passed = results.filter((r) => r.status === "pass").length;
      const failed = results.filter((r) => r.status === "fail").length;
      
      if (failed === 0) {
        toast.success(`Tutti i ${passed} test avanzati passati!`);
      } else {
        toast.warning(`${passed} passati, ${failed} falliti`);
      }
    } catch (error) {
      toast.error("Errore durante l'esecuzione dei test");
    } finally {
      setIsRunningAdvanced(false);
    }
  };

  const handleResetTestData = async () => {
    toast.info("Reset dati di test in corso...");
    const result = await resetTestData();
    if (result.success) {
      toast.success("Dati di test eliminati");
    } else {
      toast.error("Errore durante il reset");
    }
  };

  const handleClearResults = () => {
    clearResults();
    setAutoRunLog([]);
    toast.info("Risultati cancellati");
  };

  const handleRerunAll = async () => {
    hasRunRef.current = false;
    clearResults();
    setAutoRunLog([]);
    setAutoRunPhase("idle");
    // Re-trigger the useEffect by forcing a re-render
    setTimeout(() => {
      hasRunRef.current = false;
      window.location.reload();
    }, 100);
  };

  const isAnyTestRunning = isRunningCore || isRunningAdvanced || autoRunPhase === "resetting" || autoRunPhase === "running_core" || autoRunPhase === "running_advanced";

  const getPhaseLabel = () => {
    switch (autoRunPhase) {
      case "resetting": return "Reset in corso...";
      case "running_core": return "Core Tests in corso...";
      case "running_advanced": return "Advanced Tests in corso...";
      case "completed": return "Completato";
      default: return "In attesa";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FlaskConical className="h-8 w-8" />
          System Tests
        </h1>
        <p className="text-muted-foreground">
          Test automatici del sistema — eseguiti al caricamento della pagina
        </p>
      </div>

      {/* Auto-run Status */}
      {autoRunPhase !== "idle" && (
        <Card className={autoRunPhase === "completed" ? "border-green-500/50" : "border-primary/50"}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isAnyTestRunning && <Loader2 className="h-4 w-4 animate-spin" />}
                {autoRunPhase === "completed" && <CheckCircle className="h-4 w-4 text-green-500" />}
                Esecuzione Automatica
              </CardTitle>
              <Badge variant={autoRunPhase === "completed" ? "default" : "secondary"}>
                {getPhaseLabel()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32 rounded bg-muted/50 p-3">
              <div className="space-y-1 font-mono text-xs">
                {autoRunLog.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={log.includes("❌") ? "text-destructive" : log.includes("✅") ? "text-green-600" : "text-muted-foreground"}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Manual Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Manuali</CardTitle>
          <CardDescription>
            Esegui suite di test o resetta i dati manualmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleRerunAll}
              disabled={isAnyTestRunning}
              variant="default"
              className="gap-2"
            >
              {isAnyTestRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              ESEGUI TUTTI (Reset + Core + Advanced)
            </Button>

            <Separator orientation="vertical" className="h-10" />

            <Button
              onClick={handleRunCoreTests}
              disabled={isAnyTestRunning}
              variant="secondary"
              className="gap-2"
            >
              {isRunningCore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              RUN CORE TESTS
            </Button>

            <Button
              onClick={handleRunAdvancedTests}
              disabled={isAnyTestRunning}
              variant="secondary"
              className="gap-2"
            >
              {isRunningAdvanced ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              RUN ADVANCED TESTS
            </Button>

            <Button
              onClick={handleResetTestData}
              disabled={resetStatus === "running" || isAnyTestRunning}
              variant="destructive"
              className="gap-2"
            >
              {resetStatus === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              RESET TEST DATA
            </Button>

            <Button
              onClick={handleClearResults}
              disabled={isAnyTestRunning}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Cancella Risultati
            </Button>
          </div>

          {/* Reset Status */}
          {resetStatus !== "idle" && autoRunPhase === "idle" && (
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                {resetStatus === "running" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {resetStatus === "done" && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {resetStatus === "error" && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {resetStatus === "running" && "Reset in corso..."}
                  {resetStatus === "done" && "Reset completato"}
                  {resetStatus === "error" && "Errore nel reset"}
                </span>
              </div>
              {resetDetails && (
                <p className="text-sm text-muted-foreground mt-1">{resetDetails}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {Object.keys(suites).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Risultati Test</h2>
          {Object.entries(suites).map(([name, suite]) => (
            <TestResultsTable key={name} suite={suite} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {Object.keys(suites).length === 0 && autoRunPhase === "idle" && (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessun test eseguito</h3>
            <p className="text-muted-foreground">
              I test partiranno automaticamente al caricamento
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informazioni</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Esecuzione automatica:</strong> Al caricamento della pagina, il sistema esegue Reset → Core → Advanced (se Core OK).
          </p>
          <p>
            <strong>Core Tests (Fasi 0-4):</strong> Precheck tenant, seed leads, CRUD CRM, AI endpoints, followup queue.
          </p>
          <p>
            <strong>Advanced Tests (Fasi 5-8):</strong> Toggles voice/whatsapp, appointment base, handoff HUMAN, WhatsApp gate simulate.
          </p>
          <p>
            <strong>Reset Test Data:</strong> Elimina SOLO i record con <code>source="system_test"</code>. Sicuro e idempotente.
          </p>
          <p className="text-destructive">
            <strong>Errori comuni:</strong> Se vedi errori relativi a endpoint o secrets, controlla che le edge functions siano deployate e i secrets configurati.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
