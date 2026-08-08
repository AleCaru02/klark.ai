import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicFiles = [
  "src/pages/Index.tsx",
  "src/pages/Pricing.tsx",
  "src/pages/Presentazione.tsx",
  "src/pages/ServiceAssessment.tsx",
  "src/pages/OperationalDemo.tsx",
  "src/pages/ServiceCharter.tsx",
  "src/pages/SectorLanding.tsx",
  "src/pages/Technology.tsx",
  "src/pages/Checkout.tsx",
  "src/pages/NotFound.tsx",
  "src/pages/Login.tsx",
  "src/pages/ForgotPassword.tsx",
  "src/pages/ResetPassword.tsx",
  "src/pages/Privacy.tsx",
  "src/pages/Terms.tsx",
  "src/pages/Cookies.tsx",
  "src/components/landing/Navbar.tsx",
  "src/components/landing/Footer.tsx",
  "src/components/landing/Hero.tsx",
  "src/components/landing/HeroProductPreview.tsx",
  "src/components/landing/VoiceDemo.tsx",
  "src/components/landing/CallProblem.tsx",
  "src/components/landing/TrustedBy.tsx",
  "src/components/landing/SolutionsOverview.tsx",
  "src/components/landing/HowItWorks.tsx",
  "src/components/landing/ExistingNumber.tsx",
  "src/components/landing/UseCaseTabs.tsx",
  "src/components/landing/BeforeAfter.tsx",
  "src/components/landing/Personalization.tsx",
  "src/components/landing/HumanHandoff.tsx",
  "src/components/landing/Pricing.tsx",
  "src/components/landing/MarketingPageHero.tsx",
  "src/components/CookieConsent.tsx",
];

const forbiddenDarkTokens = [
  "bg-slate-950",
  "bg-black",
  "surface-dark",
  "bg-[#070b16]",
  "bg-[#0b1020]",
  "bg-[#0d1426]",
];

describe("public light theme integrity", () => {
  it("does not use black or near-black marketing surfaces", () => {
    const violations: string[] = [];
    for (const path of publicFiles) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      for (const token of forbiddenDarkTokens) {
        if (source.includes(token)) violations.push(`${path}: ${token}`);
      }
    }
    expect(violations, `Dark public surfaces found:\n${violations.join("\n")}`).toEqual([]);
  });
});
