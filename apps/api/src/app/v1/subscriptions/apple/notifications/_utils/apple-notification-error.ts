import { AppleStoreError } from "@zoonk/core/subscriptions/apple-store-error";

/**
 * A permanently invalid Apple payload or app identity cannot succeed on retry, so acknowledge it
 * while allowing configuration and provider failures to surface as retryable 5xx responses.
 */
export function getAppleNotificationErrorResponse(error: unknown) {
  if (!(error instanceof AppleStoreError) || error.reason !== "invalidTransaction") {
    return null;
  }

  return new Response(null, { status: 204 });
}
