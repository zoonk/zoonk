import { errors } from "@/lib/api-errors";
import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";

/** Answers that can't change on a retry: Pub/Sub redelivers anything but a 2xx. */
const PERMANENT_REASONS = new Set(["accountMismatch", "invalidProduct", "invalidPurchase"]);

/**
 * A purchase Google no longer knows, a product Zoonk doesn't sell or a purchase line that belongs
 * to another account can't succeed on retry, so it's acknowledged; configuration and provider
 * failures surface as retryable 5xx responses.
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
