import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";

const routeLoadOptions = { timeout: 5000 };

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("route pubbliche in modalità preview", () => {
  it("carica la landing senza richiedere il backend", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /una receptionist ai che risponde alle chiamate/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /richiedi una demo/i })[0]).toHaveAttribute("href", "/analisi-flusso");
    expect(screen.getAllByRole("link", { name: /ascolta una chiamata/i })[0]).toHaveAttribute("href", "#voice-demo");
  });

  it("carica la richiesta demo e resta fail-closed senza backend", async () => {
    window.history.pushState({}, "", "/analisi-flusso");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /raccontaci come gestisci le chiamate/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /richiedi la demo/i })).toBeDisabled();
    expect(screen.getByText(/non devi conoscere strumenti tecnici/i)).toBeInTheDocument();
  });

  it("carica demo e carta del servizio senza dati esterni", async () => {
    window.history.pushState({}, "", "/demo-operativa");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /guarda cosa succede dopo la risposta/i }, routeLoadOptions)).toBeInTheDocument();
    cleanup();

    window.history.pushState({}, "", "/carta-servizio");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /carta del servizio/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getByText(/documento informativo, non contratto definitivo/i)).toBeInTheDocument();
  });

  it("carica la pagina sul funzionamento senza mettere i provider al centro", async () => {
    window.history.pushState({}, "", "/tecnologia");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /una receptionist affidabile non deve soltanto parlare/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getByText(/nessuna funzione viene dichiarata attiva senza un test reale/i)).toBeInTheDocument();
  });

  it("carica pagine settore con contenuto e FAQ specifiche", async () => {
    window.history.pushState({}, "", "/settori/ristoranti");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /receptionist ai per ristoranti/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getByText(/il telefono tende a squillare proprio durante preparazione/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /può confermare una prenotazione/i })).toBeInTheDocument();
  });

  it("reindirizza il vecchio checkout alla richiesta demo senza pagamento", async () => {
    window.history.pushState({}, "", "/checkout?plan=growth");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /raccontaci come gestisci le chiamate/i }, routeLoadOptions)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/analisi-flusso");
    expect(window.location.search).toContain("plan=growth");
  });

  it("carica una 404 professionale", async () => {
    window.history.pushState({}, "", "/pagina-che-non-esiste");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /questa pagina non esiste o è stata spostata/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /torna alla homepage/i })).toHaveAttribute("href", "/");
  });

  it("carica il login unificato e segnala il backend non configurato", async () => {
    window.history.pushState({}, "", "/login");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /accedi al tuo account/i }, routeLoadOptions)).toBeInTheDocument();
    expect(screen.getByText(/accesso temporaneamente non disponibile/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accedi" })).toBeDisabled();
  });
});
