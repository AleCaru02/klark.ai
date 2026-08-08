import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sitemap = readFileSync(resolve(process.cwd(), "public/sitemap.xml"), "utf8");
const robots = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");
const meta = readFileSync(resolve(process.cwd(), "src/hooks/usePageMeta.ts"), "utf8");

const indexablePaths = [
  "/",
  "/analisi-flusso",
  "/demo-operativa",
  "/carta-servizio",
  "/presentazione",
  "/tecnologia",
  "/pricing",
  "/settori/studi-professionali",
  "/settori/studi-sanitari",
  "/settori/gestione-immobiliare",
  "/settori/ristoranti",
  "/settori/hotel-strutture-ricettive",
  "/settori/centri-estetici-parrucchieri",
  "/settori/agenzie-immobiliari",
  "/privacy",
  "/terms",
  "/cookies",
] as const;

const privateOrUtilityPaths = ["/login", "/forgot-password", "/reset-password", "/checkout", "/app", "/admin"] as const;

describe("public SEO integrity", () => {
  it("keeps every intended indexable canonical URL in the sitemap", () => {
    for (const path of indexablePaths) {
      const url = `https://www.clerkai.it${path === "/" ? "/" : path}`;
      expect(sitemap).toContain(`<loc>${url}</loc>`);
      expect(meta).toContain(`canonicalPath: "${path}"`);
    }
  });

  it("keeps private, auth and retired checkout routes out of sitemap", () => {
    for (const path of privateOrUtilityPaths) {
      expect(sitemap).not.toContain(`<loc>https://www.clerkai.it${path}`);
    }
  });

  it("does not block commercial pages or render-critical assets in robots", () => {
    expect(robots).toContain("Allow: /");
    expect(robots).not.toMatch(/Disallow:\s*\/(pricing|presentazione|analisi-flusso|demo-operativa|settori)/);
    expect(robots).not.toMatch(/Disallow:\s*\/(assets|src|css|js)/);
    expect(robots).toContain("Sitemap: https://www.clerkai.it/sitemap.xml");
  });

  it("keeps checkout and authentication explicitly noindex", () => {
    for (const path of ["/checkout", "/login", "/forgot-password", "/reset-password"]) {
      const routeIndex = meta.indexOf(`"${path}":`);
      expect(routeIndex).toBeGreaterThanOrEqual(0);
      expect(meta.slice(routeIndex, routeIndex + 420)).toContain("index: false");
    }
  });
});
