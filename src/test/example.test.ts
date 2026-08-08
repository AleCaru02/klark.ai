import { describe, expect, it } from "vitest";
import { product } from "../config/product";

describe("product configuration", () => {
  it("uses an HTTPS public URL and a support email", () => {
    expect(product.publicUrl.startsWith("https://")).toBe(true);
    expect(product.supportEmail).toContain("@");
    expect(product.minimumCommitmentMonths).toBeGreaterThan(0);
  });
});
