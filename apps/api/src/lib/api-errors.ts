import { NextResponse } from "next/server";
import { type z } from "zod";

export const httpStatus = {
  badRequest: 400,
  conflict: 409,
  forbidden: 403,
  internalError: 500,
  notFound: 404,
  paymentRequired: 402,
  tooManyRequests: 429,
  unauthorized: 401,
  unprocessableEntity: 422,
} as const;

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, details, message } }, { status });
}

/**
 * Keeps feature-specific error codes on the same response envelope as the
 * shared HTTP errors. Native clients use these codes for actionable recovery
 * without parsing human-readable messages.
 */
export function createErrorResponse({
  code,
  details,
  message,
  status,
}: {
  code: string;
  details?: unknown;
  message: string;
  status: number;
}) {
  return errorResponse(code, message, status, details);
}

/** Too much at once: `Retry-After` says when to try again. */
export function slowDownError({
  details,
  message,
  retryAfterSeconds,
}: {
  details: unknown;
  message: string;
  retryAfterSeconds: number;
}) {
  const response = createErrorResponse({
    code: "SLOW_DOWN",
    details,
    message,
    status: httpStatus.tooManyRequests,
  });

  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/** Signed out, or not found: a resource of another learner reads as missing too. */
export function accessError(status: "notFound" | "unauthorized", notFoundMessage?: string) {
  return status === "unauthorized" ? errors.unauthorized() : errors.notFound(notFoundMessage);
}

export const errors = {
  badRequest: (msg = "Invalid request") => errorResponse("BAD_REQUEST", msg, httpStatus.badRequest),
  conflict: (msg = "Resource already exists") =>
    errorResponse("CONFLICT", msg, httpStatus.conflict),
  forbidden: (msg = "Access denied") => errorResponse("FORBIDDEN", msg, httpStatus.forbidden),
  internal: (msg = "Internal server error") =>
    errorResponse("INTERNAL_ERROR", msg, httpStatus.internalError),
  notFound: (msg = "Resource not found") => errorResponse("NOT_FOUND", msg, httpStatus.notFound),
  unauthorized: (msg = "Authentication required") =>
    errorResponse("UNAUTHORIZED", msg, httpStatus.unauthorized),
  unprocessableEntity: (msg = "Request could not be applied") =>
    errorResponse("UNPROCESSABLE_ENTITY", msg, httpStatus.unprocessableEntity),
  validation: (zodError: z.ZodError) => {
    const details = zodError.issues.map((issue) => ({ message: issue.message, path: issue.path }));
    return errorResponse("VALIDATION_ERROR", "Invalid request", httpStatus.badRequest, details);
  },
} as const;
