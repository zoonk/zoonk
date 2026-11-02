import { AppleStoreError } from "@zoonk/core/subscriptions/apple-store-error";

/**
 * Apple retries a notification that isn't acknowledged, so a payload that can never succeed is
 * acknowledged while configuration and provider failures stay retryable 5xx responses.
 */
export function getAppleNotificationErrorResponse(error: unknown) {
  if (!(error instanceof AppleStoreError) || error.reason !== "invalidTransaction") {
    return null;
  }

  return new Response(null, { status: 204 });
}
