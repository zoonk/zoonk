import {
  GOOGLE_PLAY_PACKAGE_NAME,
  GoogleApiError,
  callGoogleApi,
  getGoogleServiceAccount,
} from "@zoonk/auth/google-service-account";
import { GooglePlayError } from "./google-play-error";
import { createVerifiedGooglePlaySubscription } from "./google-play-purchase";

const ANDROID_PUBLISHER_URL = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE_NAME}`;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;

/** Statuses for a token Google doesn't know, or no longer reports (expired more than 60 days ago). */
const INVALID_PURCHASE_STATUSES = new Set([HTTP_BAD_REQUEST, HTTP_NOT_FOUND]);

/** The shared service account's failures, in Google Play's terms. */
function toGooglePlayError(error: unknown): never {
  throw error instanceof GoogleApiError
    ? new GooglePlayError(error.reason, { cause: error })
    : error;
}

export function getGooglePlayServiceAccount() {
  try {
    return getGoogleServiceAccount();
  } catch (error) {
    return toGooglePlayError(error);
  }
}

function callAndroidPublisher(path: string, body?: unknown) {
  return callGoogleApi(`${ANDROID_PUBLISHER_URL}/${path}`, body).catch(toGooglePlayError);
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
