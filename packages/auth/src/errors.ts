import { getNumber, getString, isJsonObject } from "@zoonk/utils/json";
import { isAPIError } from "better-auth/api";
import { ACCESS_ERROR_CODES } from "./access-contract";

const PRODUCT_CODES: Record<string, string> = {
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: ACCESS_ERROR_CODES.untrustedOrigin,
  INVALID_ORIGIN: ACCESS_ERROR_CODES.untrustedOrigin,
  MISSING_OR_NULL_ORIGIN: ACCESS_ERROR_CODES.untrustedOrigin,
  VERIFICATION_FAILED: ACCESS_ERROR_CODES.botDetected,
};

function toProductCode(code: string | null): string | null {
  return code === null ? null : (PRODUCT_CODES[code] ?? code);
}

export class NativeAuthResponseError extends Error {
  readonly body: unknown;
  readonly retryAfter?: number;
  readonly statusCode: number;

  constructor({
    body,
    retryAfter,
    statusCode,
  }: {
    body: unknown;
    retryAfter?: number;
    statusCode: number;
  }) {
    super(getString(body, "message") ?? "Invalid auth request");
    this.body = body;
    this.name = "NativeAuthResponseError";
    this.retryAfter = retryAfter;
    this.statusCode = statusCode;
  }
}

export type AuthErrorDetails = {
  code?: string;
  message: string;
  retryAfter?: number;
  statusCode?: number;
};

export function getAuthError(error: unknown): AuthErrorDetails | null {
  if (!isAPIError(error) && !(error instanceof NativeAuthResponseError)) {
    return null;
  }

  const body = isJsonObject(error.body) ? error.body : null;
  const code = toProductCode(getString(body, "code"));
  const retryAfter = getNumber(error, "retryAfter");
  const statusCode = getNumber(error, "statusCode");

  return {
    ...(code && { code }),
    message: getString(body, "message") ?? error.message,
    ...(typeof retryAfter === "number" && { retryAfter }),
    ...(typeof statusCode === "number" && { statusCode }),
  };
}
