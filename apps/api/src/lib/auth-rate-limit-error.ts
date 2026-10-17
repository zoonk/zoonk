import { getAuthError } from "@zoonk/auth/errors";
import { createErrorResponse, httpStatus } from "./api-errors";
import { sessionErrorCodes } from "./session-error-codes";

/**
 * Better Auth's rate limit (by IP and path) as the shared error envelope, with `Retry-After` when
 * the limiter says how long to wait. Null for any other error.
 */
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
