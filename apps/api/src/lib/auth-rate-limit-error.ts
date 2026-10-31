import { getAuthError } from "@zoonk/auth/errors";
import { createErrorResponse, httpStatus } from "./api-errors";
import { sessionErrorCodes } from "./session-error-codes";

export function authRateLimitError(error: unknown) {
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
