import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { AppleSubscriptionError } from "@zoonk/core/subscriptions/apple-sync";

export function getAppleSubscriptionErrorResponse(error: unknown) {
  if (!(error instanceof AppleSubscriptionError)) {
    return null;
  }

  switch (error.reason) {
    case "unauthorized":
      return errors.unauthorized();
    case "accountMismatch":
      return createErrorResponse({
        code: "APPLE_ACCOUNT_MISMATCH",
        message: "This App Store purchase belongs to another account",
        status: httpStatus.conflict,
      });
    case "conflict":
      return createErrorResponse({
        code: "APPLE_SUBSCRIPTION_CONFLICT",
        message: "This App Store subscription is already linked to another account",
        status: httpStatus.conflict,
      });
    case "invalidProduct":
      return createErrorResponse({
        code: "APPLE_PRODUCT_UNSUPPORTED",
        message: "This App Store product is not supported",
        status: httpStatus.badRequest,
      });
    case "invalidTransaction":
      return createErrorResponse({
        code: "APPLE_TRANSACTION_INVALID",
        message: "The App Store transaction could not be verified",
        status: httpStatus.badRequest,
      });
    case "configuration":
    case "unavailable":
      return null;
    default:
      return null;
  }
}
