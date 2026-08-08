export type PlanCode = "essential" | "growth" | "pro" | "enterprise";

export type ProductPlan = {
  code: PlanCode;
  name: string;
  priceMonth: number;
  priceQuarter: number;
  pricePrefix?: string;
  setupFee: number | null;
  subtitle: string;
  recommended: boolean;
  features: string[];
  usage: string[];
  includedVoiceMinutes: number | null;
  estimatedCostPerVoiceMinute: number;
  estimatedFixedCostMonth: number;
  overage: string;
  cta: string;
};

export const VOICE_OVERAGE_EUR_PER_MINUTE = 0.39;
export const DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE = 0.14;
export const WHATSAPP_PLATFORM_MARKUP_EUR = 0.01;

export const plans: ProductPlan[] = [
  {
    code: "essential",
    name: "Essential",
    priceMonth: 199,
    priceQuarter: 597,
    setupFee: 0,
    subtitle: "Risposta telefonica AI, agenda e knowledge base",
    recommended: false,
    features: [
      "Numero voce italiano, inoltro o portabilità secondo disponibilità",
      "Twilio per chiamate inbound e outbound",
      "Voce naturale ElevenLabs via API",
      "OpenAI per comprensione, strumenti e riepiloghi",
      "Google Calendar: prenota, sposta e cancella",
      "CRM, knowledge base e passaggio a una persona",
      "Configurazione standard e collaudo iniziale inclusi",
    ],
    usage: ["200 minuti voce connessa inclusi al mese", "1 flusso operativo", "1 calendario"],
    includedVoiceMinutes: 200,
    estimatedCostPerVoiceMinute: DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE,
    estimatedFixedCostMonth: 38,
    overage: `Voce extra: €${VOICE_OVERAGE_EUR_PER_MINUTE.toFixed(2).replace(".", ",")}/min equivalente, conteggio effettivo al secondo.`,
    cta: "Richiedi Essential",
  },
  {
    code: "growth",
    name: "Growth",
    priceMonth: 399,
    priceQuarter: 1197,
    setupFee: 0,
    subtitle: "Acquisizione lead, chiamate, WhatsApp, chatbot e follow-up avanzato",
    recommended: true,
    features: [
      "Tutto di Essential",
      "Meta Lead Ads con mapping dei campi nel CRM",
      "WhatsApp Business tramite Meta Cloud API",
      "Chatbot per il sito con knowledge base e acquisizione lead",
      "Prima chiamata automatica e sequenze multi-step",
      "Modalità semplice e avanzata del workflow",
      "Più pipeline, alert consumi e controlli di qualità",
      "Configurazione standard e collaudo iniziale inclusi",
    ],
    usage: ["650 minuti voce connessa inclusi al mese", "1.500 risposte chatbot al mese", "WhatsApp a consumo secondo categoria e paese", "Follow-up avanzato"],
    includedVoiceMinutes: 650,
    estimatedCostPerVoiceMinute: DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE,
    estimatedFixedCostMonth: 58,
    overage: `Voce extra: €${VOICE_OVERAGE_EUR_PER_MINUTE.toFixed(2).replace(".", ",")}/min. WhatsApp: costo Meta effettivo + markup piattaforma configurabile.`,
    cta: "Richiedi il piano consigliato",
  },
  {
    code: "pro",
    name: "Pro",
    priceMonth: 749,
    priceQuarter: 2247,
    setupFee: 0,
    subtitle: "Più flussi, campagne, calendari e controllo operativo",
    recommended: false,
    features: [
      "Tutto di Growth",
      "Più campagne, flussi e calendari",
      "Chatbot sito con 5.000 risposte mensili e retention configurabile",
      "Knowledge base estesa e fonti versionate",
      "Workflow e regole differenziati per intento",
      "Report avanzati, revisione conversazioni e priorità",
      "Integrazioni standard e supervisione del rollout",
      "Configurazione standard e collaudo iniziale inclusi",
    ],
    usage: ["1.500 minuti voce connessa inclusi al mese", "5.000 risposte chatbot al mese", "WhatsApp a consumo", "Configurazioni operative multiple"],
    includedVoiceMinutes: 1500,
    estimatedCostPerVoiceMinute: DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE,
    estimatedFixedCostMonth: 88,
    overage: `Voce extra: €${VOICE_OVERAGE_EUR_PER_MINUTE.toFixed(2).replace(".", ",")}/min. WhatsApp e integrazioni speciali sono rendicontati separatamente.`,
    cta: "Richiedi Pro",
  },
  {
    code: "enterprise",
    name: "Enterprise",
    priceMonth: 1290,
    priceQuarter: 3870,
    pricePrefix: "da",
    setupFee: null,
    subtitle: "Sedi, volumi, SLA e integrazioni personalizzate",
    recommended: false,
    features: [
      "Più sedi, tenant o numeri",
      "Volumi voce e chatbot personalizzati",
      "CRM e API su progetto",
      "SLA, monitoraggio ed escalation dedicati",
      "Controlli di sicurezza e rollout concordato",
      "Assistenza e governance personalizzate",
    ],
    usage: ["Quote definite nel contratto", "Infrastruttura e provider dimensionati sul volume"],
    includedVoiceMinutes: null,
    estimatedCostPerVoiceMinute: DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE,
    estimatedFixedCostMonth: 160,
    overage: "Consumi, numeri, chatbot, WhatsApp e servizi esterni sono definiti nel preventivo.",
    cta: "Richiedi Enterprise",
  },
];

export const defaultPlanCode: PlanCode = "growth";

export function getPlan(code: string | null | undefined): ProductPlan {
  return plans.find((plan) => plan.code === code) ?? plans.find((plan) => plan.code === defaultPlanCode)!;
}

export function estimatePlanEconomics(
  plan: ProductPlan,
  usedVoiceMinutes = plan.includedVoiceMinutes ?? 0,
  costPerMinute = plan.estimatedCostPerVoiceMinute,
  fixedCostMonth = plan.estimatedFixedCostMonth,
) {
  const billableIncludedMinutes = Math.min(usedVoiceMinutes, plan.includedVoiceMinutes ?? usedVoiceMinutes);
  const extraMinutes = Math.max(0, usedVoiceMinutes - (plan.includedVoiceMinutes ?? usedVoiceMinutes));
  const extraRevenue = extraMinutes * VOICE_OVERAGE_EUR_PER_MINUTE;
  const revenue = plan.priceMonth + extraRevenue;
  const estimatedCost = usedVoiceMinutes * costPerMinute + fixedCostMonth;
  const grossMargin = revenue - estimatedCost;
  const grossMarginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;

  return {
    billableIncludedMinutes,
    extraMinutes,
    extraRevenue,
    revenue,
    estimatedCost,
    grossMargin,
    grossMarginPercent,
  };
}
