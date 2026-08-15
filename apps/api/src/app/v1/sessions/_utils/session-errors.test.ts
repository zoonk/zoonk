import { NativeAuthResponseError } from "@zoonk/auth/errors";
import { describe, expect, it } from "vitest";
import {
  getAppleSessionErrorResponse,
  getEmailSessionErrorResponse,
  getGoogleSessionErrorResponse,
} from "./session-errors";

const sessionErrorMappers = [
  getAppleSessionErrorResponse,
  getEmailSessionErrorResponse,
  getGoogleSessionErrorResponse,
];

describe("native session errors", () => {
  it.each(sessionErrorMappers)(
    "maps auth rate limits to the stable product error",
    async (mapError) => {
      const response = mapError(
        new NativeAuthResponseError({
          body: { message: "Too many requests" },
          retryAfter: 7,
          statusCode: 429,
        }),
      );

      expect(response?.status).toBe(429);
      expect(response?.headers.get("Retry-After")).toBe("7");

      await expect(response?.json()).resolves.toMatchObject({
        error: { code: "RATE_LIMIT_EXCEEDED" },
      });
    },
  );

  it.each([
    { code: "FAILED_TO_GET_USER_INFO" },
    { code: "INVALID_TOKEN" },
    { code: "USER_EMAIL_NOT_FOUND" },
    { code: undefined },
  ])("maps Apple authorization failures to the stable product error", async ({ code }) => {
    const error = new NativeAuthResponseError({ body: code ? { code } : {}, statusCode: 401 });
    const response = getAppleSessionErrorResponse(error);

    expect(response?.status).toBe(401);

    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "APPLE_AUTHORIZATION_INVALID" },
    });
  });

  it("does not classify an ambiguous Better Auth code without an authorization status", () => {
    const response = getAppleSessionErrorResponse(
      new NativeAuthResponseError({ body: { code: "OAUTH_LINK_ERROR" }, statusCode: 500 }),
    );

    expect(response).toBeNull();
  });
});
