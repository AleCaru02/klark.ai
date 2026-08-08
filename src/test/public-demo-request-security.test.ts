import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicFn = readFileSync(resolve(process.cwd(), "supabase/functions/public-demo-request/index.ts"), "utf8");
const adminFn = readFileSync(resolve(process.cwd(), "supabase/functions/admin-demo-requests/index.ts"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260808093500_public_demo_requests.sql"), "utf8");

describe("public demo request security", () => {
  it("restricts origins and validates requests server-side", () => {
    expect(publicFn).toContain("allowedOrigins");
    expect(publicFn).toContain("Controlla i campi obbligatori");
    expect(publicFn).toContain("payload.website");
    expect(publicFn).toContain("request_fingerprint");
    expect(publicFn).toContain("Troppe richieste");
  });

  it("writes through the service role while direct database access stays revoked", () => {
    expect(publicFn).toContain("createServiceClient");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.demo_requests from anon");
    expect(migration).toContain("revoke all on table public.demo_requests from authenticated");
    expect(migration).not.toContain("grant insert on table public.demo_requests to anon");
    expect(migration).not.toContain("grant select on table public.demo_requests to authenticated");
  });

  it("requires a platform-admin check before admin reads or updates", () => {
    expect(adminFn).toContain("is_platform_admin");
    expect(adminFn).toContain("Forbidden");
    expect(adminFn).toContain('action === "list"');
    expect(adminFn).toContain('action === "update-status"');
    expect(adminFn).not.toContain("request_fingerprint");
  });
});
