import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { getBetterAuthError } from "@/lib/better-auth-errors";
import { EmailAccountDeletionError } from "@zoonk/auth/email-deletion-contract";
import { AppleAuthorizationError, NativeAppleAccountError } from "@zoonk/auth/native-apple";

/**
 * Converts Better Auth's provider-specific OTP outcomes into stable product
 * API codes. Keeping each outcome distinct lets native clients offer the
 * correct recovery action without depending on Better Auth's public contract.
 */
function getEmailOTPDeletionError(code?: string) {
  if (code === "INVALID_OTP") {
    return {
      code: "ACCOUNT_DELETION_INVALID_OTP",
      message: "The code is incorrect. Try again",
      status: httpStatus.badRequest,
    };
  }

  if (code === "OTP_EXPIRED") {
    return {
      code: "ACCOUNT_DELETION_OTP_EXPIRED",
      message: "The code has expired. Request a new code and try again",
      status: httpStatus.badRequest,
    };
  }

  if (code === "TOO_MANY_ATTEMPTS") {
    return {
      code: "ACCOUNT_DELETION_OTP_LOCKED",
      message: "Too many incorrect attempts. Request a new code and try again",
      status: httpStatus.forbidden,
    };
  }

  return null;
}

/**
 * Preserves the actionable authentication outcomes from Better Auth while
 * keeping the public product API on its standard JSON error envelope.
 */
export function getAccountDeletionErrorResponse(error: unknown) {
  if (error instanceof EmailAccountDeletionError) {
    return createErrorResponse({
      code: "ACCOUNT_DELETION_EMAIL_MISMATCH",
      message: "Email authorization does not match this account",
      status: httpStatus.unauthorized,
    });
  }

  if (
    error instanceof NativeAppleAccountError ||
    (error instanceof AppleAuthorizationError && error.reason === "invalidCredential")
  ) {
    return createErrorResponse({
      code: "ACCOUNT_DELETION_APPLE_MISMATCH",
      message: "Apple authorization does not match this account",
      status: httpStatus.unauthorized,
    });
  }

  const authError = getBetterAuthError(error);

  if (!authError) {
    return null;
  }

  if (authError.statusCode === httpStatus.unauthorized) {
    return errors.unauthorized();
  }

  const emailOTPError = getEmailOTPDeletionError(authError.code);

  if (emailOTPError) {
    return createErrorResponse(emailOTPError);
  }

  if (authError.code === "SESSION_EXPIRED" || authError.code === "SESSION_NOT_FRESH") {
    return errors.forbidden("Sign in again to delete your account");
  }

  return null;
}
