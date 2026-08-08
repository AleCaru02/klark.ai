import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE,
  VOICE_OVERAGE_EUR_PER_MINUTE,
  estimatePlanEconomics,
  getPlan,
  plans,
} from "../config/plans";

const publicSourceFiles = [
  "index.html",
  "src/pages/Index.tsx",
  "src/pages/Pricing.tsx",
  "src/pages/Presentazione.tsx",
  "src/pages/Technology.tsx",
  "src/pages/Checkout.tsx",
  "src/pages/Login.tsx",
  "src/pages/Privacy.tsx",
  "src/pages/Terms.tsx",
  "src/pages/Cookies.tsx",
  "src/components/landing/Hero.tsx",
  "src/components/landing/Benefits.tsx",
  "src/components/landing/TrustedBy.tsx",
  "src/components/landing/Testimonials.tsx",
  "src/components/landing/Footer.tsx",
  "src/components/landing/WhatsAppWidget.tsx",
];

const homepageCommercialFiles = [
  "src/pages/Index.tsx",
  "src/components/landing/Hero.tsx",
  "src/components/landing/HeroProductPreview.tsx",
  "src/components/landing/TrustedBy.tsx",
  "src/components/landing/SolutionsOverview.tsx",
  "src/components/landing/HowItWorks.tsx",
  "src/components/landing/CallProblem.tsx",
  "src/components/landing/ExistingNumber.tsx",
  "src/components/landing/BeforeAfter.tsx",
  "src/components/landing/Personalization.tsx",
  "src/components/landing/HumanHandoff.tsx",
  "src/components/landing/UseCaseTabs.tsx",
  "src/components/landing/Pricing.tsx",
  "src/components/landing/Navbar.tsx",
  "src/components/landing/Footer.tsx",
];

const forbiddenPublicClaims = [
  "620+",
  "48.000+",
  "97%",
  "–40%",
  "100% GDPR compliant",
  "ClerkAI S.r.l.",
  "Via Example",
  "IT00000000000",
  "393400000000",
  "02 0000 0000",
  "attiva in 5 minuti",
  "parti in pochi minuti",
  "non percepiranno la differenza",
  "sostituisce completamente una persona",
];

const infrastructureBrands = ["Twilio", "ElevenLabs", "OpenAI", "Supabase"];

describe("product plan integrity", () => {
  it("uses one unique code and a consistent quarterly total", () => {
    expect(new Set(plans.map((plan) => plan.code)).size).toBe(plans.length);
    for (const plan of plans) {
      expect(plan.priceQuarter).toBe(plan.priceMonth * 3);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.usage.length).toBeGreaterThan(0);
      expect(plan.estimatedCostPerVoiceMinute).toBeGreaterThan(0);
    }
  });

  it("keeps approved public prices and includes standard activation", () => {
    expect(getPlan("essential").priceMonth).toBe(199);
    expect(getPlan("essential").setupFee).toBe(0);
    expect(getPlan("growth").priceMonth).toBe(399);
    expect(getPlan("growth").priceQuarter).toBe(1197);
    expect(getPlan("growth").setupFee).toBe(0);
    expect(getPlan("pro").priceMonth).toBe(749);
    expect(getPlan("pro").priceQuarter).toBe(2247);
    expect(getPlan("pro").setupFee).toBe(0);
    expect(getPlan("enterprise").priceMonth).toBe(1290);
    expect(getPlan("enterprise").setupFee).toBeNull();
  });

  it("uses the approved overage and prudent technical cost", () => {
    expect(VOICE_OVERAGE_EUR_PER_MINUTE).toBe(0.39);
    expect(DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE).toBe(0.14);
    const economics = estimatePlanEconomics(getPlan("growth"), 700);
    expect(economics.extraMinutes).toBe(50);
    expect(economics.extraRevenue).toBeCloseTo(19.5);
    expect(economics.grossMargin).toBeGreaterThan(0);
  });

  it("falls back to the recommended plan for unknown codes", () => {
    expect(getPlan("unknown").code).toBe("growth");
  });
});

describe("public claim integrity", () => {
  it("does not reintroduce fabricated metrics, identities or contacts", () => {
    const corpus = publicSourceFiles
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n")
      .toLocaleLowerCase("it-IT");

    for (const claim of forbiddenPublicClaims) {
      expect(corpus).not.toContain(claim.toLocaleLowerCase("it-IT"));
    }
  });

  it("keeps infrastructure brands out of the primary homepage narrative", () => {
    const corpus = homepageCommercialFiles
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n");

    for (const brand of infrastructureBrands) {
      expect(corpus).not.toContain(brand);
    }
  });

  it("keeps the existing-number promise conditional on technical compatibility", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/landing/ExistingNumber.tsx"),
      "utf8",
    );

    expect(source).toContain("quando tecnicamente possibile");
    expect(source).toContain("La soluzione dipende da operatore, linea, documentazione e configurazione disponibili");
  });
});
