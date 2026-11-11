import { SignJWT, importPKCS8 } from "jose";
import { z } from "zod";

export const GOOGLE_PLAY_PACKAGE_NAME = "com.zoonk";

type ServiceAccountConfig = { envVar: string; scopes: string };

const GOOGLE_PLAY: ServiceAccountConfig = {
  envVar: "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY",
  scopes: [
    "https://www.googleapis.com/auth/androidpublisher",
    "https://www.googleapis.com/auth/playintegrity",
  ].join(" "),
};

const FIREBASE_MESSAGING: ServiceAccountConfig = {
  envVar: "FIREBASE_SERVICE_ACCOUNT_KEY",
  scopes: "https://www.googleapis.com/auth/firebase.messaging",
};

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
  project_id: z.string().min(1).optional(),
});

const accessTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

const cachedAccessTokens = new Map<string, { expiresAt: number; token: string }>();

function readServiceAccount(envVar: string) {
  const value = process.env[envVar]?.trim();

  if (!value) {
    throw new GoogleApiError("configuration");
  }

  try {
    const key = serviceAccountKeySchema.parse(JSON.parse(value));
    return { email: key.client_email, privateKey: key.private_key, projectId: key.project_id };
  } catch (error) {
    throw new GoogleApiError("configuration", { cause: error });
  }
}

export function getGoogleServiceAccount() {
  const { email, privateKey } = readServiceAccount(GOOGLE_PLAY.envVar);
  return { email, privateKey };
}

export function hasFirebaseServiceAccount(): boolean {
  return Boolean(process.env[FIREBASE_MESSAGING.envVar]?.trim());
}

async function fetchFromGoogle(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new GoogleApiError("unavailable", { cause: error });
  }
}

async function requestAccessToken({
  email,
  privateKey,
  scopes,
}: {
  email: string;
  privateKey: string;
  scopes: string;
}) {
  const key = await importPKCS8(privateKey, "RS256").catch((error: unknown) => {
    throw new GoogleApiError("configuration", { cause: error });
  });

  const issuedAt = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: scopes })
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

async function getAccessToken({ envVar, scopes }: ServiceAccountConfig) {
  const serviceAccount = readServiceAccount(envVar);
  const cached = cachedAccessTokens.get(envVar);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const { access_token: token, expires_in: expiresIn } = await requestAccessToken({
    ...serviceAccount,
    scopes,
  });

  cachedAccessTokens.set(envVar, {
    expiresAt: Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_MARGIN_MS,
    token,
  });

  return token;
}

async function callWithServiceAccount({
  body,
  config,
  url,
}: {
  body?: unknown;
  config: ServiceAccountConfig;
  url: string;
}) {
  const token = await getAccessToken(config);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const response = await fetchFromGoogle(
    url,
    body === undefined ? { headers } : { body: JSON.stringify(body), headers, method: "POST" },
  );

  /** A revoked or rotated key invalidates the cached token. */
  if (response.status === HTTP_UNAUTHORIZED) {
    cachedAccessTokens.delete(config.envVar);
  }

  return response;
}

export async function callGoogleApi(url: string, body?: unknown) {
  return callWithServiceAccount({ body, config: GOOGLE_PLAY, url });
}

/** FCM HTTP v1 `messages:send` for the Firebase project the service account belongs to. */
export async function sendFirebaseMessage(message: unknown) {
  const { projectId } = readServiceAccount(FIREBASE_MESSAGING.envVar);

  if (!projectId) {
    throw new GoogleApiError("configuration");
  }

  return callWithServiceAccount({
    body: { message },
    config: FIREBASE_MESSAGING,
    url: `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
  });
}
