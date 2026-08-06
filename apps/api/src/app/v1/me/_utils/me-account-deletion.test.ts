import { EmailAccountDeletionError } from "@zoonk/auth/email-deletion-contract";
import { AppleAuthorizationError, NativeAppleAccountError } from "@zoonk/auth/native-apple";
import { describe, expect, it } from "vitest";
import { getAccountDeletionErrorResponse } from "./me-account-deletion";

describe(getAccountDeletionErrorResponse, () => {
  it.each([
    new NativeAppleAccountError("Apple account mismatch"),
    new AppleAuthorizationError("invalidCredential"),
  ])("maps invalid native Apple credentials to an actionable 401 response", async (error) => {
    const response = getAccountDeletionErrorResponse(error);

    await expect(response?.json()).resolves.toStrictEqual({
      error: {
        code: "ACCOUNT_DELETION_APPLE_MISMATCH",
        message: "Apple authorization does not match this account",
      },
    });

    expect(response?.status).toBe(401);
  });

  it("maps a verified email belonging to another user to an actionable 401 response", async () => {
    const response = getAccountDeletionErrorResponse(
      new EmailAccountDeletionError("Email reauthorization does not match the current user"),
    );

    await expect(response?.json()).resolves.toStrictEqual({
      error: {
        code: "ACCOUNT_DELETION_EMAIL_MISMATCH",
        message: "Email authorization does not match this account",
      },
    });

    expect(response?.status).toBe(401);
  });

  it.each([
    {
      authCode: "INVALID_OTP",
      code: "ACCOUNT_DELETION_INVALID_OTP",
      message: "The code is incorrect. Try again",
      status: 400,
    },
    {
      authCode: "OTP_EXPIRED",
      code: "ACCOUNT_DELETION_OTP_EXPIRED",
      message: "The code has expired. Request a new code and try again",
      status: 400,
    },
    {
      authCode: "TOO_MANY_ATTEMPTS",
      code: "ACCOUNT_DELETION_OTP_LOCKED",
      message: "Too many incorrect attempts. Request a new code and try again",
      status: 403,
    },
  ])(
    "maps Better Auth $authCode failures to an actionable product response",
    async ({ authCode, code, message, status }) => {
      const response = getAccountDeletionErrorResponse({
        body: { code: authCode, message: "Invalid OTP" },
        name: "APIError",
        statusCode: status,
      });

      await expect(response?.json()).resolves.toStrictEqual({ error: { code, message } });

      expect(response?.status).toBe(status);
    },
  );

  it("keeps a missing or expired base session distinct from credential mismatch", async () => {
    const response = getAccountDeletionErrorResponse({
      body: { code: "INVALID_TOKEN", message: "Invalid token" },
      name: "APIError",
      statusCode: 401,
    });

    await expect(response?.json()).resolves.toStrictEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    expect(response?.status).toBe(401);
  });

  it.each([new AppleAuthorizationError("configuration"), new Error("database unavailable")])(
    "leaves non-actionable failures for the API error boundary",
    (error) => {
      expect(getAccountDeletionErrorResponse(error)).toBeNull();
    },
  );
});
