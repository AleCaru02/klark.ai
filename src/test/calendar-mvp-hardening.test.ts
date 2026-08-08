import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Google Calendar MVP hardening", () => {
  const authStart = read("supabase/functions/google-auth-start/index.ts");
  const callback = read("supabase/functions/google-auth-callback/index.ts");
  const booking = read("supabase/functions/ai-book-appointment/index.ts");
  const migration = read("supabase/migrations/20260808200000_calendar_booking_hardening.sql");
  const tokenHardening = read("supabase/migrations/20260805160736_2e6184b2-582e-42ba-b404-d70b83e631f8.sql");

  it("requests offline least-privilege scopes required for list, event write and FreeBusy", () => {
    expect(authStart).toContain("calendar.calendarlist.readonly");
    expect(authStart).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(authStart).toContain("calendar.events.freebusy");
    expect(authStart).toContain('authUrl.searchParams.set("access_type", "offline")');
    expect(authStart).toContain('authUrl.searchParams.set("include_granted_scopes", "true")');
    expect(authStart).toContain('authUrl.searchParams.set("state", state)');
  });

  it("requires a configured app URL and preserves the only durable refresh token", () => {
    expect(callback).toContain('requiredEnv("APP_URL")');
    expect(callback).not.toContain("assistant-call-sync.lovable.app");
    expect(callback).toContain("hasRequiredCalendarScopes");
    expect(callback).toContain('select("refresh_token")');
    expect(callback).toContain("refresh_token_missing");
  });

  it("keeps OAuth tokens backend-only and provider credentials out of browser code", () => {
    expect(tokenHardening).toContain("REVOKE ALL ON public.google_tokens FROM anon, authenticated");
    expect(tokenHardening).toContain("GRANT ALL ON public.google_tokens TO service_role");
    expect(callback).toContain('requiredEnv("GOOGLE_CLIENT_SECRET")');
  });

  it("returns reconnect-required for revoked/invalid Google credentials", () => {
    expect(booking).toContain('throw new AuthError("Google Calendar reconnection required", 409)');
    expect(booking).toContain('action: "google_oauth.refresh_failed"');
  });

  it("protects concurrent booking at database level and maps collision to HTTP 409", () => {
    expect(migration).toContain("appointments_no_active_overlap");
    expect(migration).toContain("tstzrange(start_at, end_at, '[)') WITH &&");
    expect(booking).toContain('appointmentError?.code === "23P01"');
  });
});
