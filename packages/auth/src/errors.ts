import { getNumber, getString, isJsonObject } from "@zoonk/utils/json";
import { isAPIError } from "better-auth/api";

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

/** Normalizes dependency and adapter errors at the auth package boundary so consumers do not depend on Better Auth internals. */
export function getAuthError(error: unknown): AuthErrorDetails | null {
  if (!isAPIError(error) && !(error instanceof NativeAuthResponseError)) {
    return null;
  }

  const body = isJsonObject(error.body) ? error.body : null;
  const code = getString(body, "code");
  const retryAfter = getNumber(error, "retryAfter");
  const statusCode = getNumber(error, "statusCode");

  return {
    ...(code && { code }),
    message: getString(body, "message") ?? error.message,
    ...(typeof retryAfter === "number" && { retryAfter }),
    ...(typeof statusCode === "number" && { statusCode }),
  };
}
