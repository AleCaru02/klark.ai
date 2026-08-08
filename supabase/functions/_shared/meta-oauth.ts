import { requiredEnv } from "./security.ts";

export interface MetaTokenResult {
  accessToken: string;
  expiresIn: number;
}

export async function exchangeMetaAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<MetaTokenResult> {
  const appId = requiredEnv("FACEBOOK_APP_ID");
  const appSecret = requiredEnv("FACEBOOK_APP_SECRET");

  const shortResponse = await fetch(
    "https://graph.facebook.com/v18.0/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
    },
  );
  const shortData = await shortResponse.json() as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!shortResponse.ok || !shortData.access_token) {
    throw new Error(
      `Meta token exchange failed: ${shortData.error?.message || shortResponse.status}`,
    );
  }

  const longResponse = await fetch(
    "https://graph.facebook.com/v18.0/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortData.access_token,
      }),
    },
  );
  const longData = await longResponse.json() as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!longResponse.ok || !longData.access_token) {
    return {
      accessToken: shortData.access_token,
      expiresIn: Number(shortData.expires_in || 3600),
    };
  }

  return {
    accessToken: longData.access_token,
    expiresIn: Number(longData.expires_in || 5_184_000),
  };
}

export async function metaGraphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const url = `https://graph.facebook.com/v18.0/${path.replace(/^\//, "")}${
    queryString ? `?${queryString}` : ""
  }`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json() as unknown;
  if (!response.ok) {
    const providerMessage = isRecord(data) && isRecord(data.error) &&
        typeof data.error.message === "string"
      ? data.error.message
      : String(response.status);
    throw new Error(`Meta Graph API failed: ${providerMessage}`);
  }
  return data as T;
}

export function randomBase64Url(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
