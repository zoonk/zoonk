import { SignJWT, importPKCS8 } from "jose";
import { z } from "zod";

export const GOOGLE_PLAY_PACKAGE_NAME = "com.zoonk";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/androidpublisher",
  "https://www.googleapis.com/auth/playintegrity",
].join(" ");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_SECONDS = 3600;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;

export type GoogleApiErrorReason = "configuration" | "unavailable";

export class GoogleApiError extends Error {
  readonly reason: GoogleApiErrorReason;

  constructor(reason: GoogleApiErrorReason, options?: ErrorOptions) {
    super(`Google API error: ${reason}`, options);
    this.name = "GoogleApiError";
    this.reason = reason;
  }
}

const serviceAccountKeySchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
});

const accessTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

let cachedAccessToken: { expiresAt: number; token: string } | null = null;

export function getGoogleServiceAccount() {
  const value = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY?.trim();

  if (!value) {
    throw new GoogleApiError("configuration");
  }

  try {
    const key = serviceAccountKeySchema.parse(JSON.parse(value));
    return { email: key.client_email, privateKey: key.private_key };
  } catch (error) {
    throw new GoogleApiError("configuration", { cause: error });
  }
}

async function fetchFromGoogle(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new GoogleApiError("unavailable", { cause: error });
  }
}

async function requestAccessToken({ email, privateKey }: { email: string; privateKey: string }) {
  const key = await importPKCS8(privateKey, "RS256").catch((error: unknown) => {
    throw new GoogleApiError("configuration", { cause: error });
  });

  const issuedAt = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: GOOGLE_SCOPES })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TOKEN_LIFETIME_SECONDS)
    .sign(key);

  const response = await fetchFromGoogle(TOKEN_URL, {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new GoogleApiError(
      response.status >= HTTP_SERVER_ERROR ? "unavailable" : "configuration",
    );
  }

  return accessTokenResponseSchema.parse(await response.json());
}

async function getAccessToken() {
  const serviceAccount = getGoogleServiceAccount();

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const { access_token: token, expires_in: expiresIn } = await requestAccessToken(serviceAccount);
  cachedAccessToken = { expiresAt: Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_MARGIN_MS, token };
  return token;
}

export async function callGoogleApi(url: string, body?: unknown) {
  const token = await getAccessToken();
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const response = await fetchFromGoogle(
    url,
    body === undefined ? { headers } : { body: JSON.stringify(body), headers, method: "POST" },
  );

  /** A revoked or rotated key invalidates the cached token. */
  if (response.status === HTTP_UNAUTHORIZED) {
    cachedAccessToken = null;
  }

  return response;
}
