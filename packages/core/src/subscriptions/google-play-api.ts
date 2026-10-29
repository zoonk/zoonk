import { SignJWT, importPKCS8 } from "jose";
import { z } from "zod";
import { GooglePlayError } from "./google-play-error";
import { createVerifiedGooglePlaySubscription } from "./google-play-purchase";

export const GOOGLE_PLAY_PACKAGE_NAME = "com.zoonk";

const ANDROID_PUBLISHER_URL = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE_NAME}`;
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_SECONDS = 3600;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;
const HTTP_SERVER_ERROR = 500;

/** Statuses for a token Google doesn't know, or no longer reports (expired more than 60 days ago). */
const INVALID_PURCHASE_STATUSES = new Set([HTTP_BAD_REQUEST, HTTP_NOT_FOUND]);

const serviceAccountKeySchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
});

const accessTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

let cachedAccessToken: { expiresAt: number; token: string } | null = null;

export function getGooglePlayServiceAccount() {
  const value = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY?.trim();

  if (!value) {
    throw new GooglePlayError("configuration");
  }

  try {
    const key = serviceAccountKeySchema.parse(JSON.parse(value));
    return { email: key.client_email, privateKey: key.private_key };
  } catch (error) {
    throw new GooglePlayError("configuration", { cause: error });
  }
}

async function fetchFromGoogle(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new GooglePlayError("unavailable", { cause: error });
  }
}

async function requestAccessToken({ email, privateKey }: { email: string; privateKey: string }) {
  const key = await importPKCS8(privateKey, "RS256").catch((error: unknown) => {
    throw new GooglePlayError("configuration", { cause: error });
  });

  const issuedAt = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: ANDROID_PUBLISHER_SCOPE })
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
    throw new GooglePlayError(
      response.status >= HTTP_SERVER_ERROR ? "unavailable" : "configuration",
    );
  }

  return accessTokenResponseSchema.parse(await response.json());
}

async function getAccessToken() {
  const serviceAccount = getGooglePlayServiceAccount();

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const { access_token: token, expires_in: expiresIn } = await requestAccessToken(serviceAccount);
  cachedAccessToken = { expiresAt: Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_MARGIN_MS, token };
  return token;
}

async function callAndroidPublisher(path: string, body?: unknown) {
  const token = await getAccessToken();
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const response = await fetchFromGoogle(
    `${ANDROID_PUBLISHER_URL}/${path}`,
    body === undefined ? { headers } : { body: JSON.stringify(body), headers, method: "POST" },
  );

  /** A revoked or rotated key invalidates the cached token. */
  if (response.status === HTTP_UNAUTHORIZED) {
    cachedAccessToken = null;
  }

  return response;
}

/** 401 and 403 mean the service account lacks Play Console access or its key was revoked. */
function getFailureReason(status: number) {
  return status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN
    ? "configuration"
    : "unavailable";
}

/** Google's current state of the purchase, its source of truth; null while it's pending. */
export async function getGooglePlaySubscription(purchaseToken: string) {
  const readAt = new Date();

  const response = await callAndroidPublisher(
    `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
  );

  /** Google says a 410 token will never be valid again: stop asking about it. */
  if (response.status === HTTP_GONE) {
    throw new GooglePlayError("ended");
  }

  if (INVALID_PURCHASE_STATUSES.has(response.status)) {
    throw new GooglePlayError("invalidPurchase");
  }

  if (!response.ok) {
    throw new GooglePlayError(getFailureReason(response.status));
  }

  return createVerifiedGooglePlaySubscription({
    purchaseToken,
    readAt,
    resource: await response.json(),
  });
}

/**
 * Google refunds a subscription nobody acknowledged within three days. A resubscription from the
 * Play Store has no account id, so the acknowledgement stores the owner's for its later purchases.
 */
export async function acknowledgeGooglePlaySubscription({
  accountId,
  productId,
  purchaseToken,
}: {
  accountId?: string;
  productId: string;
  purchaseToken: string;
}) {
  const response = await callAndroidPublisher(
    `purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    accountId ? { externalAccountIds: { obfuscatedAccountId: accountId } } : {},
  );

  if (!response.ok) {
    throw new GooglePlayError(getFailureReason(response.status));
  }
}
