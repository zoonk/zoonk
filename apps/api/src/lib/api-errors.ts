import { NextResponse } from "next/server";
import { type z } from "zod";

export const httpStatus = {
  badRequest: 400,
  conflict: 409,
  forbidden: 403,
  internalError: 500,
  notFound: 404,
  paymentRequired: 402,
  unauthorized: 401,
  unprocessableEntity: 422,
} as const;

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, details, message } }, { status });
}

export const errors = {
  badRequest: (msg = "Invalid request") => errorResponse("BAD_REQUEST", msg, httpStatus.badRequest),
  conflict: (msg = "Resource already exists") =>
    errorResponse("CONFLICT", msg, httpStatus.conflict),
  forbidden: (msg = "Access denied") => errorResponse("FORBIDDEN", msg, httpStatus.forbidden),
  internal: (msg = "Internal server error") =>
    errorResponse("INTERNAL_ERROR", msg, httpStatus.internalError),
  notFound: (msg = "Resource not found") => errorResponse("NOT_FOUND", msg, httpStatus.notFound),
  paymentRequired: (msg = "Active subscription required") =>
    errorResponse("PAYMENT_REQUIRED", msg, httpStatus.paymentRequired),
  unauthorized: (msg = "Authentication required") =>
    errorResponse("UNAUTHORIZED", msg, httpStatus.unauthorized),
  validation: (zodError: z.ZodError) => {
    const details = zodError.issues.map((issue) => ({ message: issue.message, path: issue.path }));
    return errorResponse("VALIDATION_ERROR", "Invalid request", httpStatus.badRequest, details);
  },
} as const;
