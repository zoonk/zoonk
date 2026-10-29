import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";

export function getGooglePlaySubscriptionErrorResponse(error: unknown) {
  if (!(error instanceof GooglePlayError)) {
    return null;
  }

  switch (error.reason) {
    case "unauthorized":
      return errors.unauthorized();
    case "accountMismatch":
      return createErrorResponse({
        code: "GOOGLE_PLAY_ACCOUNT_MISMATCH",
        message: "This Google Play purchase belongs to another account",
        status: httpStatus.conflict,
      });
    case "conflict":
      return createErrorResponse({
        code: "GOOGLE_PLAY_SUBSCRIPTION_CONFLICT",
        message: "This Google Play subscription is already linked to another account",
        status: httpStatus.conflict,
      });
    case "invalidProduct":
      return createErrorResponse({
        code: "GOOGLE_PLAY_PRODUCT_UNSUPPORTED",
        message: "This Google Play product is not supported",
        status: httpStatus.badRequest,
      });
    case "ended":
    case "invalidPurchase":
      return createErrorResponse({
        code: "GOOGLE_PLAY_PURCHASE_INVALID",
        message: "The Google Play purchase could not be verified",
        status: httpStatus.badRequest,
      });
    case "configuration":
    case "unavailable":
      return null;
    default:
      return null;
  }
}
