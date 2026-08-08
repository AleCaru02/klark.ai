import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorId: string | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorId: null,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true,
      errorId: crypto.randomUUID?.() ?? `err-${Date.now()}`,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Non inviare automaticamente dati o stack trace a servizi esterni.
    // In produzione questo punto può essere collegato a un sistema di monitoraggio approvato.
    console.error("Errore applicativo non gestito", {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
      errorId: this.state.errorId,
    });
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background px-4 py-16" role="main">
        <section className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-destructive">Errore applicativo</p>
          <h1 className="mt-2 text-2xl font-bold">La pagina non può essere caricata</h1>
          <p className="mt-3 text-muted-foreground">
            Nessuna operazione viene considerata completata. Ricarica la pagina oppure torna alla home.
          </p>
          {this.state.errorId && (
            <p className="mt-3 text-xs text-muted-foreground">
              Codice diagnostico: <code>{this.state.errorId}</code>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Ricarica
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
            >
              Torna alla home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
