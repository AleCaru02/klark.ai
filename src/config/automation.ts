export type ProviderStatus =
  | "not_configured"
  | "incomplete"
  | "verifying"
  | "tested"
  | "active"
  | "error"
  | "suspended";

export type SectorPreset = {
  code: string;
  name: string;
  description: string;
  intents: string[];
  crmFields: string[];
  defaultAppointmentMinutes: number;
  escalation: string[];
  forbiddenTopics: string[];
};

export const providerArchitecture = [
  {
    code: "twilio",
    name: "Twilio Voice",
    role: "Numeri italiani, chiamate inbound/outbound, Media Streams e callback",
    requirement: "Numero geografico, inoltro o portabilità soggetti a disponibilità e documentazione",
  },
  {
    code: "elevenlabs",
    name: "ElevenLabs",
    role: "Voce naturale in tempo reale tramite API",
    requirement: "Chiave server-side, budget, voce approvata e test di latenza",
  },
  {
    code: "openai",
    name: "OpenAI API",
    role: "Comprensione, ragionamento, tool calling, riepiloghi e RAG",
    requirement: "Chiave server-side, policy, limiti e fallback umano",
  },
  {
    code: "google",
    name: "Google Calendar",
    role: "Disponibilità, prenotazione, spostamento, cancellazione e Meet",
    requirement: "OAuth, calendario selezionato, redirect URI e test conflitti",
  },
  {
    code: "meta_leads",
    name: "Meta Lead Ads",
    role: "Acquisizione lead, mapping campi, consenso e webhook",
    requirement: "Business, pagina, modulo, permessi e lead di test",
  },
  {
    code: "whatsapp",
    name: "Meta WhatsApp Cloud API",
    role: "Messaggi, template, conferme, opt-out e finestra di assistenza",
    requirement: "WABA, numero, Embedded Signup, template e webhook verificati",
  },
  {
    code: "stripe",
    name: "Stripe",
    role: "Abbonamenti trimestrali, fatture e consumi extra",
    requirement: "Prodotti, prezzi, meters, webhook e test live",
  },
  {
    code: "resend",
    name: "Resend",
    role: "Credenziali, onboarding e comunicazioni transazionali",
    requirement: "Dominio, DNS, mittente e consegna verificati",
  },
] as const;

export const voicePresets = [
  { code: "female_professional", name: "Femminile professionale", tone: "Chiara, misurata e autorevole" },
  { code: "female_warm", name: "Femminile cordiale", tone: "Calda, naturale e rassicurante" },
  { code: "female_dynamic", name: "Femminile dinamica", tone: "Energica e orientata all'azione" },
  { code: "male_professional", name: "Maschile professionale", tone: "Precisa, stabile e formale" },
  { code: "male_warm", name: "Maschile cordiale", tone: "Calma, naturale e accogliente" },
  { code: "male_authoritative", name: "Maschile autorevole", tone: "Decisa e adatta a contesti B2B" },
] as const;

export const defaultMetaLeadFollowup = {
  code: "meta_lead_standard_v1",
  name: "Lead Meta standard",
  disclosureRequired: true,
  allowedStartHour: "09:00",
  allowedEndHour: "18:30",
  maxCallsPerDay: 2,
  maxCallsTotal: 5,
  steps: [
    { day: 0, offsetMinutes: 1, channel: "voice", action: "Chiama il nuovo lead" },
    { day: 0, offsetMinutes: 3, channel: "whatsapp", action: "Messaggio dopo mancata risposta" },
    { day: 0, offsetMinutes: 31, channel: "voice", action: "Secondo tentativo" },
    { day: 1, offsetMinutes: 0, channel: "voice", action: "Tentativo in fascia opposta" },
    { day: 1, offsetMinutes: 10, channel: "whatsapp", action: "Proponi due orari" },
    { day: 3, offsetMinutes: 0, channel: "voice", action: "Nuovo tentativo e proposta appuntamento" },
    { day: 5, offsetMinutes: 0, channel: "voice", action: "Ultimo tentativo" },
    { day: 5, offsetMinutes: 10, channel: "whatsapp", action: "Messaggio conclusivo e stato non raggiunto" },
  ],
  stopConditions: [
    "Risposta del contatto",
    "Appuntamento prenotato",
    "Richiesta di richiamo con data e ora",
    "Opt-out o richiesta di non essere contattato",
    "Numero errato o irraggiungibile definitivo",
    "Richiesta di parlare con una persona",
    "Conversazione manuale aperta",
  ],
} as const;

export const sectorPresets: SectorPreset[] = [
  {
    code: "healthcare",
    name: "Studi dentistici e sanitari",
    description: "Gestione organizzativa, appuntamenti e richieste informative non cliniche.",
    intents: ["prenotazione", "spostamento", "cancellazione", "orari", "servizi", "urgenza organizzativa"],
    crmFields: ["prestazione richiesta", "prima visita", "sede", "preferenza oraria"],
    defaultAppointmentMinutes: 30,
    escalation: ["sintomi o diagnosi", "urgenza clinica", "contestazione sanitaria"],
    forbiddenTopics: ["diagnosi", "prescrizioni", "consulenza medica"],
  },
  {
    code: "beauty",
    name: "Centri estetici e parrucchieri",
    description: "Prenotazioni, servizi, disponibilità, conferme e recupero lead.",
    intents: ["prenotazione", "servizi", "prezzi", "durata", "operatore", "promozioni autorizzate"],
    crmFields: ["servizio", "operatore", "durata", "prima visita"],
    defaultAppointmentMinutes: 60,
    escalation: ["reclamo", "reazione avversa", "rimborso"],
    forbiddenTopics: ["promesse di risultato", "valutazioni mediche"],
  },
  {
    code: "real_estate",
    name: "Agenzie immobiliari",
    description: "Qualificazione acquirenti, venditori, locazioni e appuntamenti visite.",
    intents: ["acquisto", "vendita", "affitto", "valutazione", "visita", "documenti"],
    crmFields: ["zona", "budget", "tipologia", "tempistica", "finanziamento"],
    defaultAppointmentMinutes: 30,
    escalation: ["proposta formale", "negoziazione", "aspetti legali"],
    forbiddenTopics: ["valutazioni garantite", "consulenza legale"],
  },
  {
    code: "property_admin",
    name: "Amministratori condominiali",
    description: "Segnalazioni, classificazione urgenze, appuntamenti e passaggi ai fornitori.",
    intents: ["guasto", "segnalazione", "appuntamento", "documenti", "pagamenti", "emergenza"],
    crmFields: ["condominio", "scala", "unità", "tipo problema", "urgenza"],
    defaultAppointmentMinutes: 20,
    escalation: ["pericolo persone", "incendio", "perdita grave", "controversia"],
    forbiddenTopics: ["decisioni legali", "autorizzazioni di spesa non previste"],
  },
  {
    code: "automotive",
    name: "Officine e concessionari",
    description: "Preventivi iniziali, appuntamenti, stato lavorazione e test drive.",
    intents: ["tagliando", "guasto", "preventivo", "test drive", "ritiro", "stato lavorazione"],
    crmFields: ["targa", "modello", "chilometraggio", "problema", "data preferita"],
    defaultAppointmentMinutes: 45,
    escalation: ["veicolo non sicuro", "contestazione costo", "soccorso"],
    forbiddenTopics: ["diagnosi tecnica certa senza verifica"],
  },
  {
    code: "restaurant",
    name: "Ristoranti",
    description: "Prenotazioni, modifiche, gruppi, allergie dichiarate e richieste eventi.",
    intents: ["prenotazione", "modifica", "cancellazione", "menu", "allergie", "evento"],
    crmFields: ["coperti", "data", "ora", "allergie dichiarate", "occasione"],
    defaultAppointmentMinutes: 120,
    escalation: ["allergia grave", "gruppo numeroso", "reclamo"],
    forbiddenTopics: ["garanzia assenza contaminazione"],
  },
  {
    code: "fitness",
    name: "Palestre e centri fitness",
    description: "Prove, iscrizioni, corsi, appuntamenti e recupero richieste.",
    intents: ["prova", "abbonamento", "corso", "orari", "personal trainer", "disdetta"],
    crmFields: ["obiettivo", "corso", "fascia oraria", "prima esperienza"],
    defaultAppointmentMinutes: 30,
    escalation: ["infortunio", "reclamo", "recesso"],
    forbiddenTopics: ["prescrizioni mediche", "risultati fisici garantiti"],
  },
  {
    code: "professional_services",
    name: "Studi professionali",
    description: "Qualificazione preliminare e prenotazione senza fornire consulenza riservata.",
    intents: ["prima consulenza", "documenti", "appuntamento", "scadenza", "preventivo"],
    crmFields: ["materia", "urgenza", "documenti disponibili", "azienda o privato"],
    defaultAppointmentMinutes: 45,
    escalation: ["parere professionale", "scadenza imminente", "conflitto di interesse"],
    forbiddenTopics: ["consulenza legale", "consulenza fiscale definitiva"],
  },
  {
    code: "field_services",
    name: "Imprese di servizi",
    description: "Richieste intervento, preventivi, disponibilità tecnici e priorità.",
    intents: ["preventivo", "sopralluogo", "guasto", "manutenzione", "stato intervento"],
    crmFields: ["indirizzo", "tipo intervento", "urgenza", "foto disponibili"],
    defaultAppointmentMinutes: 60,
    escalation: ["pericolo", "danno grave", "contestazione"],
    forbiddenTopics: ["preventivo definitivo senza sopralluogo"],
  },
  {
    code: "hospitality",
    name: "Hotel e strutture ricettive",
    description: "Richieste soggiorno, informazioni, assistenza e passaggio al personale.",
    intents: ["disponibilità", "servizi", "check-in", "modifica", "problema soggiorno"],
    crmFields: ["date", "ospiti", "camera", "richieste speciali"],
    defaultAppointmentMinutes: 15,
    escalation: ["sicurezza", "ospite bloccato", "reclamo grave"],
    forbiddenTopics: ["disponibilità non verificata", "rimborsi non autorizzati"],
  },
  {
    code: "b2b",
    name: "Aziende B2B",
    description: "Qualificazione commerciale, demo, richieste tecniche e routing al team.",
    intents: ["demo", "preventivo", "partnership", "supporto", "rinnovo", "acquisti"],
    crmFields: ["azienda", "ruolo", "dimensione", "esigenza", "tempistica", "budget"],
    defaultAppointmentMinutes: 30,
    escalation: ["negoziazione", "sicurezza", "contratto", "incidente"],
    forbiddenTopics: ["condizioni contrattuali non approvate"],
  },
  {
    code: "ecommerce",
    name: "E-commerce e customer care",
    description: "Ordini, consegne, resi, informazioni prodotto e passaggio operatore.",
    intents: ["ordine", "spedizione", "reso", "prodotto", "pagamento", "reclamo"],
    crmFields: ["numero ordine", "prodotto", "canale", "motivo contatto"],
    defaultAppointmentMinutes: 15,
    escalation: ["frode", "chargeback", "minaccia", "rimborso eccezionale"],
    forbiddenTopics: ["rimborso non autorizzato", "dati pagamento completi"],
  },
];

export const launchChecks = [
  { code: "identity", label: "Identità azienda e contatti" },
  { code: "twilio", label: "Twilio e numero voce" },
  { code: "elevenlabs", label: "ElevenLabs e voce approvata" },
  { code: "openai", label: "OpenAI server-side e limiti" },
  { code: "google", label: "Google Calendar" },
  { code: "meta_leads", label: "Meta Lead Ads" },
  { code: "whatsapp", label: "WhatsApp Cloud API" },
  { code: "knowledge", label: "Knowledge base approvata" },
  { code: "stripe", label: "Stripe live e meters" },
  { code: "email", label: "Email transazionali" },
  { code: "privacy", label: "Consensi, privacy e retention" },
  { code: "e2e", label: "Test end-to-end" },
  { code: "approval", label: "Approvazione umana finale" },
] as const;
