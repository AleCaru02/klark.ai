import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  cleanEmail,
  cleanPhone,
  cleanText,
  normalizeOrigin,
  originAllowed,
} from "./site-chat.ts";

Deno.test("normalizeOrigin accepts only HTTP origins", () => {
  assertEquals(normalizeOrigin("https://Example.com/path?q=1"), "https://example.com");
  assertEquals(normalizeOrigin("http://localhost:5173/test"), "http://localhost:5173");
  assertEquals(normalizeOrigin("javascript:alert(1)"), null);
  assertEquals(normalizeOrigin(null), null);
});

Deno.test("originAllowed matches exact origins and safe subdomain wildcards", () => {
  const allowed = [
    "https://azienda.it",
    "https://*.azienda.it",
    "http://localhost:5173",
  ];
  assertEquals(originAllowed("https://azienda.it", allowed), true);
  assertEquals(originAllowed("https://www.azienda.it", allowed), true);
  assertEquals(originAllowed("https://deep.sales.azienda.it", allowed), true);
  assertEquals(originAllowed("https://azienda.it.evil.example", allowed), false);
  assertEquals(originAllowed("http://www.azienda.it", allowed), false);
  assertEquals(originAllowed("http://localhost:5173", allowed), true);
});

Deno.test("public input cleaners reject malformed identifiers and control characters", () => {
  assertEquals(cleanText("ciao\u0000   mondo", 50), "ciao mondo");
  assertEquals(cleanEmail(" Nome@Example.COM "), "nome@example.com");
  assertEquals(cleanEmail("not-an-email"), null);
  assertEquals(cleanPhone("+39 333 123 4567"), "+393331234567");
  assertEquals(cleanPhone("123"), null);
});
