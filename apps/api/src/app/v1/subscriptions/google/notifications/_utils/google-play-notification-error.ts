import { errors } from "@/lib/api-errors";
import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";

const PERMANENT_REASONS = new Set([
  "accountMismatch",
  "ended",
  "invalidProduct",
  "invalidPurchase",
]);

/**
 * Pub/Sub redelivers anything but a 2xx: answers no retry can change are acknowledged, while
 * configuration and provider failures stay retryable 5xx responses.
 */
export function getGooglePlayNotificationErrorResponse(error: unknown) {
  if (!(error instanceof GooglePlayError)) {
    return null;
  }

  if (error.reason === "unauthorized") {
    return errors.unauthorized();
  }

  if (PERMANENT_REASONS.has(error.reason)) {
    return new Response(null, { status: 204 });
  }

  return null;
}
