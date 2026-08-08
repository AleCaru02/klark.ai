import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { product } from "@/config/product";

type PageMeta = { title: string; description: string; index: boolean; canonicalPath?: string };

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "Receptionist AI per aziende e professionisti | ClerkAI", description: "Receptionist telefonica AI per gestire chiamate, informazioni e appuntamenti anche quando il team è occupato, con regole definite e passaggio a una persona quando serve.", index: true, canonicalPath: "/" },
  "/pricing": { title: "Prezzi Receptionist AI | Piani ClerkAI", description: "Confronta i piani ClerkAI per chiamate, appuntamenti e gestione delle richieste. Prezzi e consumi sono visibili prima dell'attivazione assistita.", index: true, canonicalPath: "/pricing" },
  "/tecnologia": { title: "Come funziona una receptionist AI | ClerkAI", description: "Scopri come ClerkAI gestisce conversazione, informazioni, appuntamenti, limiti e passaggio umano senza trasformare la tecnologia nel centro dell'esperienza cliente.", index: true, canonicalPath: "/tecnologia" },
  "/presentazione": { title: "Come funziona ClerkAI | Receptionist telefonica AI", description: "Scopri come viene configurata una receptionist AI sulla tua attività: regole, informazioni, numero, appuntamenti, test e passaggio umano.", index: true, canonicalPath: "/presentazione" },
  "/analisi-flusso": { title: "Richiedi una demo Receptionist AI | ClerkAI", description: "Raccontaci come gestisci oggi chiamate e appuntamenti. Valutiamo numero, volume, obiettivi e casi da passare a una persona prima dell'attivazione.", index: true, canonicalPath: "/analisi-flusso" },
  "/demo-operativa": { title: "Demo Receptionist AI | Chiamate e passaggio umano", description: "Guarda una demo contestuale di una receptionist AI: conversazione, gestione della richiesta, limiti operativi e passaggio a una persona.", index: true, canonicalPath: "/demo-operativa" },
  "/carta-servizio": { title: "Carta del servizio ClerkAI | Limiti e responsabilità", description: "Cosa include il servizio ClerkAI, come vengono gestiti limiti, escalation, conservazione e criteri di messa online.", index: true, canonicalPath: "/carta-servizio" },
  "/settori/studi-professionali": { title: "Receptionist AI per studi professionali | ClerkAI", description: "Gestione di chiamate, richieste iniziali e appuntamenti per studi professionali con regole definite e passaggio umano quando necessario.", index: true, canonicalPath: "/settori/studi-professionali" },
  "/settori/studi-sanitari": { title: "Receptionist AI per studi medici e sanitari | ClerkAI", description: "Gestione amministrativa di chiamate e appuntamenti per studi sanitari, senza sostituire valutazioni cliniche o decisioni professionali.", index: true, canonicalPath: "/settori/studi-sanitari" },
  "/settori/gestione-immobiliare": { title: "Receptionist AI per property manager | ClerkAI", description: "Raccogli chiamate, richieste e segnalazioni immobiliari con priorità, appuntamenti e passaggio al referente corretto.", index: true, canonicalPath: "/settori/gestione-immobiliare" },
  "/settori/ristoranti": { title: "Receptionist AI per ristoranti | ClerkAI", description: "Gestisci telefonate, prenotazioni e domande ricorrenti mentre sala e cucina lavorano, con regole e disponibilità definite.", index: true, canonicalPath: "/settori/ristoranti" },
  "/settori/hotel-strutture-ricettive": { title: "Receptionist AI per hotel e B&B | ClerkAI", description: "Gestisci chiamate su check-in, servizi e richieste ospiti anche fuori reception, usando informazioni e procedure approvate.", index: true, canonicalPath: "/settori/hotel-strutture-ricettive" },
  "/settori/centri-estetici-parrucchieri": { title: "Receptionist AI per centri estetici e parrucchieri | ClerkAI", description: "Gestisci chiamate, disponibilità e appuntamenti senza interrompere trattamenti e clienti già in sede.", index: true, canonicalPath: "/settori/centri-estetici-parrucchieri" },
  "/settori/agenzie-immobiliari": { title: "Receptionist AI per agenzie immobiliari | ClerkAI", description: "Raccogli richieste sugli immobili, qualifica il contatto e organizza visite quando gli agenti sono occupati o fuori sede.", index: true, canonicalPath: "/settori/agenzie-immobiliari" },
  "/checkout": { title: "Richiedi una demo | ClerkAI", description: "L'attivazione è assistita e non prevede checkout online.", index: false },
  "/login": { title: "Accedi | ClerkAI", description: "Accedi alla dashboard ClerkAI.", index: false },
  "/forgot-password": { title: "Password dimenticata | ClerkAI", description: "Richiedi il ripristino della password.", index: false },
  "/reset-password": { title: "Reimposta password | ClerkAI", description: "Imposta una nuova password per il tuo account.", index: false },
  "/privacy": { title: "Privacy Policy | ClerkAI", description: "Informativa sul trattamento dei dati personali nel sito e nel servizio ClerkAI.", index: true, canonicalPath: "/privacy" },
  "/terms": { title: "Termini di Servizio | ClerkAI", description: "Termini e condizioni di utilizzo del servizio ClerkAI.", index: true, canonicalPath: "/terms" },
  "/cookies": { title: "Cookie Policy | ClerkAI", description: "Informativa sull'uso dei cookie nel sito ClerkAI.", index: true, canonicalPath: "/cookies" },
};

function ensureMeta(name: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) { tag = document.createElement("meta"); tag.setAttribute("name", name); document.head.appendChild(tag); }
  return tag;
}

function ensureProperty(property: string) {
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) { tag = document.createElement("meta"); tag.setAttribute("property", property); document.head.appendChild(tag); }
  return tag;
}

export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const privateArea = pathname.startsWith("/app") || pathname.startsWith("/admin");
    const meta = PAGE_META[pathname] ?? { title: privateArea ? `Dashboard | ${product.name}` : `Pagina non trovata | ${product.name}`, description: privateArea ? `Area riservata ${product.name}.` : "La pagina richiesta non è disponibile.", index: false };
    const canonicalUrl = meta.index && meta.canonicalPath ? new URL(meta.canonicalPath, product.publicUrl).toString() : null;
    const imageUrl = new URL("/icon-512.png", product.publicUrl).toString();

    document.title = meta.title;
    ensureMeta("description").setAttribute("content", meta.description);
    ensureMeta("robots").setAttribute("content", meta.index ? "index,follow" : "noindex,nofollow");
    ensureProperty("og:type").setAttribute("content", "website");
    ensureProperty("og:locale").setAttribute("content", "it_IT");
    ensureProperty("og:site_name").setAttribute("content", product.name);
    ensureProperty("og:title").setAttribute("content", meta.title);
    ensureProperty("og:description").setAttribute("content", meta.description);
    ensureProperty("og:image").setAttribute("content", imageUrl);
    ensureMeta("twitter:card").setAttribute("content", "summary");
    ensureMeta("twitter:title").setAttribute("content", meta.title);
    ensureMeta("twitter:description").setAttribute("content", meta.description);
    ensureMeta("twitter:image").setAttribute("content", imageUrl);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonicalUrl) {
      if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
      canonical.href = canonicalUrl;
      ensureProperty("og:url").setAttribute("content", canonicalUrl);
    } else {
      canonical?.remove();
      document.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [pathname]);
}
