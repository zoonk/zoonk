import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { AppleStoreError } from "@zoonk/core/subscriptions/apple-store-error";

export function getAppleNotificationErrorResponse(error: unknown) {
  if (!(error instanceof AppleStoreError) || error.reason !== "invalidTransaction") {
    return null;
  }

  return createErrorResponse({
    code: "APPLE_NOTIFICATION_INVALID",
    message: "The App Store notification could not be verified",
    status: httpStatus.badRequest,
  });
}
