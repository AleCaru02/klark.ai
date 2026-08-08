import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("call queue scheduler hardening", () => {
  const worker = read("supabase/functions/process-call-queue/index.ts");
  const migration = read("supabase/migrations/20260808190000_call_queue_scheduler.sql");
  const config = read("supabase/config.toml");

  it("uses custom scheduler authentication and never trusts a public invocation", () => {
    expect(config).toMatch(/\[functions\.process-call-queue\]\s*verify_jwt\s*=\s*false/);
    expect(worker).toContain("x-clark-scheduler-token");
    expect(worker).toContain("verify_call_queue_scheduler_token");
    expect(worker).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(migration).toContain("call_queue_scheduler_token");
    expect(migration).toContain("vault.decrypted_secrets");
  });

  it("claims only active and Voice-ready tenants with permission evidence", () => {
    expect(migration).toContain("is_tenant_service_active(q.tenant_id)");
    expect(migration).toContain("s.voice_runtime_verified = true");
    expect(migration).toContain("s.voice_enabled = true");
    expect(migration).toContain("c.do_not_contact");
    expect(migration).toContain("c.callback_requested = true");
    expect(migration).toContain("contact_permission_source");
    expect(migration).toContain("is_compliant_voice_number");
    expect(migration).toContain("for update of q skip locked");
  });

  it("enforces max attempts and recovers stale intermediate states", () => {
    expect(migration).toContain("attempt_count");
    expect(migration).toContain("max_attempts");
    expect(migration).toContain("recover_stale_call_queue");
    expect(migration).toContain("status = 'processing'");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("status = 'calling'");
    expect(migration).toContain("interval '30 minutes'");
    expect(worker).toContain("recover_stale_call_queue");
  });

  it("schedules the worker every minute only after project URL configuration", () => {
    expect(migration).toContain("call_queue_project_url");
    expect(migration).toContain("ensure_call_queue_scheduler");
    expect(migration).toContain("'process-call-queue'");
    expect(migration).toContain("'* * * * *'");
    expect(migration).toContain("net.http_post");
  });

  it("records worker heartbeat for monitoring", () => {
    expect(migration).toContain("worker_heartbeats");
    expect(worker).toContain("recordWorkerHeartbeat");
    expect(worker).toContain('worker_name: "call_queue"');
  });
});
