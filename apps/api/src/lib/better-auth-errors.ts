import { getNumber, getString, isJsonObject } from "@zoonk/utils/json";

type BetterAuthError = { code?: string; message: string; statusCode?: number };

/**
 * Narrows Better Auth's thrown APIError without importing its transitive
 * better-call package into API routes that only need the public error details.
 */
export function getBetterAuthError(error: unknown): BetterAuthError | null {
  if (getString(error, "name") !== "APIError") {
    return null;
  }

  const body = isJsonObject(error) ? error.body : null;
  const code = getString(body, "code");
  const statusCode = getNumber(error, "statusCode");

  return {
    ...(code && { code }),
    message: getString(body, "message") ?? getString(error, "message") ?? "Invalid auth request",
    ...(statusCode && { statusCode }),
  };
}
