import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const appSource = readFileSync(resolve(repositoryRoot, "src/App.tsx"), "utf8");

function pageNames(relativeDirectory: string): string[] {
  return readdirSync(resolve(repositoryRoot, relativeDirectory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => entry.name.replace(/\.tsx$/, ""))
    .sort();
}

function expectPagesImported(
  importDirectory: "pages" | "pages/app" | "pages/admin",
  filesystemDirectory: string,
  indirectPages: string[] = [],
) {
  for (const name of pageNames(filesystemDirectory)) {
    if (indirectPages.includes(name)) continue;
    expect(
      appSource,
      `${filesystemDirectory}/${name}.tsx esiste ma non è collegata alle route`,
    ).toContain(`import("./${importDirectory}/${name}")`);
  }
}

describe("integrità delle route", () => {
  it("collega ogni pagina pubblica registrata nel repository", () => {
    expectPagesImported("pages", "src/pages");
  });

  it("collega ogni pagina cliente registrata nel repository", () => {
    expectPagesImported("pages/app", "src/pages/app", ["SiteChatbot"]);
  });

  it("mantiene SiteChatbot dietro il runtime guard fail-closed", () => {
    const guardSource = readFileSync(
      resolve(repositoryRoot, "src/pages/app/SiteChatbotRuntimeGuard.tsx"),
      "utf8",
    );
    expect(appSource).toContain('import("./pages/app/SiteChatbotRuntimeGuard")');
    expect(appSource).not.toContain('import("./pages/app/SiteChatbot")');
    expect(guardSource).toContain('import SiteChatbot from "./SiteChatbot"');
    expect(guardSource).toContain('VITE_SITE_CHAT_RUNTIME_VERIFIED === "true"');
  });

  it("collega ogni pagina amministrativa registrata nel repository", () => {
    expectPagesImported("pages/admin", "src/pages/admin");
  });

  it("reindirizza la vecchia route prompt all'addestramento unificato", () => {
    expect(appSource).toContain(
      '<Route path="prompt" element={<Navigate to="/app/training" replace />} />',
    );
  });

  it("non reintroduce le vecchie pagine CRM duplicate", () => {
    const appPages = pageNames("src/pages/app");
    for (const removedPage of ["CRM", "CallQueue", "Clients", "Contacts", "LeadsToCall", "Prompt"]) {
      expect(appPages).not.toContain(removedPage);
    }
  });
});