import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppleAuthorizationError,
  exchangeNativeAppleAuthorizationCode,
  revokeAppleToken,
} from "./apple-rest";

const configuration = {
  appBundleIdentifier: "com.zoonk.dev",
  clientId: "com.zoonk.web",
  keyId: "APPLE_KEY_ID",
  privateKey: "APPLE_PRIVATE_KEY",
  teamId: "APPLE_TEAM_ID",
};

const getClientSecret = vi.fn();
const request = vi.fn();

describe("Apple REST authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientSecret.mockResolvedValue("native-client-secret");
  });

  it("exchanges a native code with the bundle identifier and no redirect URI", async () => {
    request.mockResolvedValue(
      Response.json({
        access_token: "apple-access-token",
        expires_in: 3600,
        id_token: "apple-id-token",
        refresh_token: "apple-refresh-token",
        token_type: "Bearer",
      }),
    );

    await expect(
      exchangeNativeAppleAuthorizationCode({
        authorizationCode: "single-use-code",
        dependencies: { configuration, getClientSecret, request },
      }),
    ).resolves.toStrictEqual({
      accessToken: "apple-access-token",
      expiresIn: 3600,
      idToken: "apple-id-token",
      refreshToken: "apple-refresh-token",
    });

    expect(getClientSecret).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: configuration.appBundleIdentifier,
      configuration,
    });

    const [, options] = request.mock.calls[0] ?? [];
    const body = new URLSearchParams(options?.body as string);

    expect(body.get("client_id")).toBe(configuration.appBundleIdentifier);
    expect(body.get("client_secret")).toBe("native-client-secret");
    expect(body.get("code")).toBe("single-use-code");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.has("redirect_uri")).toBe(false);
  });

  it("revokes a refresh token with the same native client identifier", async () => {
    request.mockResolvedValue(new Response(null, { status: 200 }));

    await revokeAppleToken({
      clientIdentifier: configuration.appBundleIdentifier,
      dependencies: { configuration, getClientSecret, request },
      token: "apple-refresh-token",
      tokenType: "refresh_token",
    });

    const [, options] = request.mock.calls[0] ?? [];
    const body = new URLSearchParams(options?.body as string);

    expect(body.get("client_id")).toBe(configuration.appBundleIdentifier);
    expect(body.get("token")).toBe("apple-refresh-token");
    expect(body.get("token_type_hint")).toBe("refresh_token");
  });

  it("classifies an expired or reused authorization code as an invalid credential", async () => {
    request.mockResolvedValue(Response.json({ error: "invalid_grant" }, { status: 400 }));

    await expect(
      exchangeNativeAppleAuthorizationCode({
        authorizationCode: "expired-code",
        dependencies: { configuration, getClientSecret, request },
      }),
    ).rejects.toMatchObject({
      reason: "invalidCredential",
    } satisfies Partial<AppleAuthorizationError>);
  });

  it("classifies Apple network failures as unavailable", async () => {
    request.mockRejectedValue(new Error("network unavailable"));

    await expect(
      exchangeNativeAppleAuthorizationCode({
        authorizationCode: "single-use-code",
        dependencies: { configuration, getClientSecret, request },
      }),
    ).rejects.toMatchObject({ reason: "unavailable" } satisfies Partial<AppleAuthorizationError>);
  });

  it("stops waiting when Apple does not finish the request", async () => {
    request.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("request aborted")));
        }),
    );

    await expect(
      revokeAppleToken({
        clientIdentifier: configuration.appBundleIdentifier,
        dependencies: { configuration, getClientSecret, request, requestTimeoutMs: 1 },
        token: "apple-refresh-token",
        tokenType: "refresh_token",
      }),
    ).rejects.toMatchObject({ reason: "unavailable" } satisfies Partial<AppleAuthorizationError>);
  });
});
