import { NextResponse } from "next/server";
import { type z } from "zod";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, details, message } }, { status });
}

export const errors = {
  conflict: (msg = "Resource already exists") => errorResponse("CONFLICT", msg, HTTP_CONFLICT),
  forbidden: (msg = "Access denied") => errorResponse("FORBIDDEN", msg, HTTP_FORBIDDEN),
  internal: (msg = "Internal server error") =>
    errorResponse("INTERNAL_ERROR", msg, HTTP_INTERNAL_ERROR),
  invalidApiKey: () =>
    errorResponse("UNAUTHORIZED", "Invalid or missing API key", HTTP_UNAUTHORIZED),
  notFound: (msg = "Resource not found") => errorResponse("NOT_FOUND", msg, HTTP_NOT_FOUND),
  unauthorized: (msg = "Authentication required") =>
    errorResponse("UNAUTHORIZED", msg, HTTP_UNAUTHORIZED),
  validation: (zodError: z.ZodError) => {
    const details = zodError.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    return errorResponse("VALIDATION_ERROR", "Invalid request", HTTP_BAD_REQUEST, details);
  },
} as const;
