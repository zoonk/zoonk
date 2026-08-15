import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { getAuthError } from "./errors";
import { callNativeAuthHandler } from "./native-auth-handler";

describe(getAuthError, () => {
  it("normalizes Better Auth API errors through its public predicate", () => {
    const error = new APIError("UNAUTHORIZED", {
      code: "INVALID_TOKEN",
      message: "The token is invalid",
    });

    expect(getAuthError(error)).toStrictEqual({
      code: "INVALID_TOKEN",
      message: "The token is invalid",
      statusCode: 401,
    });
  });

  it("normalizes errors from the native HTTP auth boundary", async () => {
    const error = await callNativeAuthHandler({
      body: {},
      handler: () =>
        Promise.resolve(
          Response.json(
            { message: "Too many requests" },
            { headers: { "x-retry-after": "7" }, status: 429 },
          ),
        ),
      headers: new Headers(),
      path: "/sign-in/native-apple",
      requestURL: "http://localhost:4000/v1/sessions/apple",
    }).catch((caughtError: unknown) => caughtError);

    expect(getAuthError(error)).toStrictEqual({
      message: "Too many requests",
      retryAfter: 7,
      statusCode: 429,
    });
  });

  it("does not recognize unrelated errors by a Zoonk-owned name allowlist", () => {
    expect(
      getAuthError(
        Object.assign(new Error("Not an auth error"), { name: "NativeAuthResponseError" }),
      ),
    ).toBeNull();
  });
});
