import type { ServiceClient } from "./security.ts";
import { constantTimeEqual, hmacHex, requiredEnv } from "./security.ts";

export interface SiteChatbotRecord {
  id: string;
  tenant_id: string;
  public_key: string;
  is_enabled: boolean;
  display_name: string;
  welcome_message: string;
  allowed_origins: string[];
  accent_color: string;
  position: "left" | "right";
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  require_consent: boolean;
  consent_text: string;
  create_crm_contact: boolean;
  calendar_enabled: boolean;
  escalation_enabled: boolean;
  human_label: string;
  max_messages_per_session: number;
  rate_limit_per_minute: number;
  monthly_message_limit: number;
  retention_days: number;
}

export function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function originAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  for (const candidate of allowedOrigins) {
    const trimmed = candidate.trim().toLowerCase().replace(/\/$/, "");
    if (!trimmed) continue;
    if (trimmed === normalized) return true;

    const wildcard = trimmed.match(/^(https?):\/\/\*\.([a-z0-9.-]+)(?::(\d+))?$/i);
    if (!wildcard) continue;
    const url = new URL(normalized);
    const expectedProtocol = `${wildcard[1]}:`;
    const expectedPort = wildcard[3] || "";
    const suffix = wildcard[2];
    const portMatches = expectedPort ? url.port === expectedPort : !url.port;
    if (
      url.protocol === expectedProtocol &&
      portMatches &&
      url.hostname.endsWith(`.${suffix}`) &&
      url.hostname !== suffix
    ) return true;
  }
  return false;
}

export function appOriginAllowed(origin: string): boolean {
  const appUrl = normalizeOrigin(requiredEnv("APP_URL"));
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter((item): item is string => Boolean(item));
  return Boolean(appUrl && (origin === appUrl || extra.includes(origin)));
}

export function siteChatCors(origin: string | null, allowed: boolean): Record<string, string> {
  const safeOrigin = origin && allowed ? origin : "null";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "content-type, x-clark-widget",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

export async function loadChatbot(
  client: ServiceClient,
  widgetKey: string,
): Promise<SiteChatbotRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(widgetKey)) return null;
  const { data, error } = await client
    .from("site_chatbots")
    .select("*")
    .eq("public_key", widgetKey)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) throw error;
  return data as SiteChatbotRecord | null;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

export async function hashIp(ip: string): Promise<string> {
  return hmacHex("SHA-256", requiredEnv("CHATBOT_IP_HASH_SALT"), ip);
}

export async function hashSessionToken(token: string): Promise<string> {
  return hmacHex("SHA-256", requiredEnv("CHATBOT_SESSION_SECRET"), token);
}

export async function verifySessionToken(token: string, storedHash: string): Promise<boolean> {
  if (!token || !storedHash) return false;
  const expected = await hashSessionToken(token);
  return constantTimeEqual(expected, storedHash);
}

export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function cleanEmail(value: unknown): string | null {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function cleanPhone(value: unknown): string | null {
  const raw = cleanText(value, 40).replace(/[\s().-]/g, "");
  if (!/^\+?[1-9]\d{7,14}$/.test(raw)) return null;
  return raw.startsWith("+") ? raw : `+${raw}`;
}

export function publicConfig(chatbot: SiteChatbotRecord) {
  return {
    display_name: chatbot.display_name,
    welcome_message: chatbot.welcome_message,
    accent_color: chatbot.accent_color,
    position: chatbot.position,
    collect_name: chatbot.collect_name,
    collect_email: chatbot.collect_email,
    collect_phone: chatbot.collect_phone,
    require_consent: chatbot.require_consent,
    consent_text: chatbot.consent_text,
    escalation_enabled: chatbot.escalation_enabled,
    human_label: chatbot.human_label,
    max_messages_per_session: chatbot.max_messages_per_session,
  };
}
