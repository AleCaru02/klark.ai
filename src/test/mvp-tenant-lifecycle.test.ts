import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("MVP tenant lifecycle without Stripe", () => {
  it("creates customers as pending internal service accounts", () => {
    const createUser = source("supabase/functions/create-user/index.ts");
    expect(createUser).toContain('.from("tenant_service_accounts")');
    expect(createUser).toContain('status: "pending"');
    expect(createUser).not.toContain('.from("subscriptions").insert');
    expect(createUser).not.toContain("stripe_customer_id");
  });

  it("uses the internal service account as the feature source of truth", () => {
    const hook = source("src/hooks/usePlanFeatures.ts");
    expect(hook).toContain('.from("tenant_service_accounts")');
    expect(hook).toContain('serviceStatus !== "active"');
    expect(hook).not.toContain('.from("subscriptions")');
  });

  it("gates paid runtime entrypoints server-side", () => {
    const security = source("supabase/functions/_shared/security.ts");
    expect(security).toContain("export async function requireActiveTenant");

    for (const path of [
      "supabase/functions/twilio-make-call/index.ts",
      "supabase/functions/process-call-queue/index.ts",
      "supabase/functions/ai-book-appointment/index.ts",
      "supabase/functions/site-chat-message/index.ts",
    ]) {
      expect(source(path)).toContain("requireActiveTenant");
    }
  });

  it("versions the four administrative states and fail-closed queue gate", () => {
    const migration = source("supabase/migrations/20260808162000_tenant_service_accounts.sql");
    for (const status of ["pending", "active", "suspended", "cancelled"]) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).toContain("is_tenant_service_active");
    expect(migration).toContain("trg_enforce_call_queue_active_tenant");
    expect(migration).toContain("public.is_tenant_service_active(q.tenant_id)");
  });

  it("removes Stripe activation controls from the admin creation flow", () => {
    const createUserUi = source("src/pages/admin/CreateUser.tsx");
    const tenantDetail = source("src/pages/admin/TenantDetail.tsx");
    expect(createUserUi).not.toContain("Stripe Customer ID");
    expect(createUserUi).not.toContain("VITE_STRIPE_LIVE_VERIFIED");
    expect(tenantDetail).not.toContain("stripe_customer_id");
    expect(tenantDetail).toContain('value="commercial"');
  });
});
