import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { sessionErrorCodes } from "@/lib/session-error-codes";
import { getAuthError } from "@zoonk/auth/errors";
import { AppleAuthorizationError, NativeAppleAccountError } from "@zoonk/auth/native-apple";

function isInvalidSocialAuthorization(error: unknown) {
  return getAuthError(error)?.statusCode === httpStatus.unauthorized;
}

function getRateLimitErrorResponse(error: unknown) {
  const authError = getAuthError(error);

  if (authError?.statusCode !== httpStatus.tooManyRequests) {
    return null;
  }

  const response = createErrorResponse({
    code: sessionErrorCodes.rateLimitExceeded,
    message: "Too many requests. Try again later",
    status: httpStatus.tooManyRequests,
  });

  if (authError.retryAfter !== undefined) {
    response.headers.set("Retry-After", authError.retryAfter.toString());
  }

  return response;
}

function getAccountDisabledErrorResponse(error: unknown) {
  const authError = getAuthError(error);

  return authError?.code === "BANNED_USER"
    ? createErrorResponse({
        code: sessionErrorCodes.accountDisabled,
        message: "This account is disabled",
        status: httpStatus.forbidden,
      })
    : null;
}

function getSharedSessionErrorResponse(error: unknown) {
  return getRateLimitErrorResponse(error) ?? getAccountDisabledErrorResponse(error);
}

export function getEmailSessionErrorResponse(error: unknown) {
  const sharedError = getSharedSessionErrorResponse(error);

  if (sharedError) {
    return sharedError;
  }

  const authError = getAuthError(error);

  if (authError?.code === "INVALID_OTP") {
    return createErrorResponse({
      code: sessionErrorCodes.emailCodeInvalid,
      message: "The code is incorrect. Try again",
      status: httpStatus.badRequest,
    });
  }

  if (authError?.code === "OTP_EXPIRED") {
    return createErrorResponse({
      code: sessionErrorCodes.emailCodeExpired,
      message: "The code has expired. Request a new code and try again",
      status: httpStatus.badRequest,
    });
  }

  if (authError?.code === "TOO_MANY_ATTEMPTS") {
    return createErrorResponse({
      code: sessionErrorCodes.emailCodeLocked,
      message: "Too many incorrect attempts. Request a new code and try again",
      status: httpStatus.forbidden,
    });
  }

  return null;
}

export function getGoogleSessionErrorResponse(error: unknown) {
  const sharedError = getSharedSessionErrorResponse(error);

  if (sharedError) {
    return sharedError;
  }

  if (isInvalidSocialAuthorization(error)) {
    return createErrorResponse({
      code: sessionErrorCodes.googleAuthorizationInvalid,
      message: "Google authorization is invalid or expired",
      status: httpStatus.unauthorized,
    });
  }

  return null;
}

export function getAppleSessionErrorResponse(error: unknown) {
  const sharedError = getSharedSessionErrorResponse(error);

  if (sharedError) {
    return sharedError;
  }

  if (
    error instanceof NativeAppleAccountError ||
    (error instanceof AppleAuthorizationError && error.reason === "invalidCredential") ||
    isInvalidSocialAuthorization(error)
  ) {
    return createErrorResponse({
      code: sessionErrorCodes.appleAuthorizationInvalid,
      message: "Apple authorization is invalid or expired",
      status: httpStatus.unauthorized,
    });
  }

  return null;
}
