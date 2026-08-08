import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { getAuthLandingRoute } from "@/contexts/AuthContext";

describe("role based login routing", () => {
  it("routes platform administrators to the admin dashboard", () => {
    expect(getAuthLandingRoute(true)).toBe("/admin");
  });

  it("routes normal users to the customer dashboard", () => {
    expect(getAuthLandingRoute(false)).toBe("/app");
  });

  it("uses the dedicated platform-admin check instead of tenant membership role", () => {
    const source = fs.readFileSync("src/contexts/AuthContext.tsx", "utf8");
    expect(source).toContain('supabase.rpc("is_platform_admin"');
    expect(source).not.toContain('supabase.rpc("has_membership_role"');
  });
});
