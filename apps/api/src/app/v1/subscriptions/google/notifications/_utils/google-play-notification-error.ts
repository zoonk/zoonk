import { errors } from "@/lib/api-errors";
import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";

/**
 * Pub/Sub redelivers anything but a 2xx. A purchase Google no longer knows can't succeed on retry,
 * so it's acknowledged; configuration and provider failures surface as retryable 5xx responses.
 */
export function getGooglePlayNotificationErrorResponse(error: unknown) {
  if (!(error instanceof GooglePlayError)) {
    return null;
  }

  if (error.reason === "unauthorized") {
    return errors.unauthorized();
  }

  if (error.reason === "invalidPurchase") {
    return new Response(null, { status: 204 });
  }

  return null;
}
