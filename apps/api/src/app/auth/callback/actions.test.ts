import { NativeAuthResponseError } from "@zoonk/auth/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOneTimeTokenAction, validateTrustedOriginAction } from "./actions";

const authMocks = vi.hoisted(() => ({
  generateOneTimeToken: vi.fn(),
  validateTrustedOrigin: vi.fn(),
}));

/** These adapter tests inject auth failures to check their presentation, without exercising persistence. */
vi.mock("@zoonk/auth", () => ({ auth: { api: authMocks } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const CALLBACK_URL = "http://main.zoonk.localhost:1355/auth/callback?state=login-state";

describe("auth callback error handling", () => {
  beforeEach(() => {
    authMocks.validateTrustedOrigin.mockResolvedValue({ trusted: true });
    authMocks.generateOneTimeToken.mockResolvedValue({ token: "one-time-token" });
  });

  it("rejects an untrusted destination without issuing a token", async () => {
    authMocks.validateTrustedOrigin.mockRejectedValue(
      new NativeAuthResponseError({ body: { message: "UNTRUSTED_ORIGIN" }, statusCode: 403 }),
    );

    await expect(validateTrustedOriginAction(CALLBACK_URL)).resolves.toBe(false);

    await expect(createOneTimeTokenAction(CALLBACK_URL)).resolves.toMatchObject({
      error: "UNTRUSTED_ORIGIN",
      success: false,
    });

    expect(authMocks.generateOneTimeToken).not.toHaveBeenCalled();
  });

  it("does not disguise a session failure as an untrusted destination", async () => {
    const error = new NativeAuthResponseError({
      body: { message: "Unauthorized" },
      statusCode: 401,
    });

    authMocks.validateTrustedOrigin.mockRejectedValue(error);

    await expect(validateTrustedOriginAction(CALLBACK_URL)).rejects.toBe(error);
  });

  it("propagates unexpected validation and token failures", async () => {
    const error = new Error("Authentication storage unavailable");
    authMocks.validateTrustedOrigin.mockRejectedValueOnce(error);

    await expect(validateTrustedOriginAction(CALLBACK_URL)).rejects.toBe(error);

    authMocks.generateOneTimeToken.mockRejectedValue(error);
    await expect(createOneTimeTokenAction(CALLBACK_URL)).rejects.toBe(error);
  });

  it("preserves the return path and login state when adding the token", async () => {
    await expect(createOneTimeTokenAction(CALLBACK_URL)).resolves.toStrictEqual({
      success: true,
      url: `${CALLBACK_URL}&token=one-time-token`,
    });
  });
});
