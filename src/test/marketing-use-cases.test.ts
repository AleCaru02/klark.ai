import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync("src/components/landing/UseCaseTabs.tsx", "utf8");

const requiredSectors = [
  "Ecommerce",
  "Hotel e strutture ricettive",
  "Qualifica Lead",
  "Studi Medici",
  "Studi Legali",
  "Agenzie Immobiliari",
  "Ristoranti",
  "Centri estetici e parrucchieri",
  "Assistenza Clienti",
];

describe("homepage sector interaction examples", () => {
  it("keeps the main requested business sectors visible", () => {
    for (const sector of requiredSectors) {
      expect(source).toContain(`label: "${sector}"`);
    }
  });

  it("shows a customer message, ClerkAI response and operational result", () => {
    expect(source).toContain("Cliente");
    expect(source).toContain("ClerkAI");
    expect(source).toContain("Risultato operativo");
    expect(source).toContain("customer:");
    expect(source).toContain("assistant:");
    expect(source).toContain("result:");
  });

  it("clearly identifies examples as demos and preserves professional guardrails", () => {
    expect(source).toContain("Scenari dimostrativi, non conversazioni di clienti reali");
    expect(source).toContain("nessuna diagnosi o indicazione clinica viene improvvisata");
    expect(source).toContain("Non fornisco pareri legali");
    expect(source).toContain("ClerkAI non deve inventare informazioni");
  });

  it("uses a light trust palette without black section backgrounds", () => {
    expect(source).toContain("from-sky-50 via-white to-cyan-50/60");
    expect(source).toContain("border-sky-200 bg-white");
    expect(source).toContain("bg-sky-50");
    expect(source).not.toContain("bg-slate-950");
    expect(source).not.toContain("bg-black");
  });
});
