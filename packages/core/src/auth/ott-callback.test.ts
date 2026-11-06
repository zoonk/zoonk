import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { USAGE_DATA_COOKIE } from "@zoonk/utils/usage-data";
import { cookies, headers } from "next/headers";
import { type NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { trackServerEvent } from "../analytics/server";
import { verifyOneTimeTokenCallback } from "./ott-callback";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "./ott-state";

const authMocks = vi.hoisted(() => ({ verifyOneTimeToken: vi.fn() }));

vi.mock("@zoonk/auth", () => ({
  auth: { api: { verifyOneTimeToken: authMocks.verifyOneTimeToken } },
}));

const STATE = "login-state";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

function callbackRequest(path: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE ? { name, value: STATE } : undefined,
    },
    headers: new Headers({ "accept-language": "pt-BR" }),
    nextUrl: new URL(path, "http://localhost:3000"),
  } as unknown as NextRequest;
}

function signedInCallback(userId: string): NextRequest {
  authMocks.verifyOneTimeToken.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=signed; Path=/" }),
    response: { session: {}, user: { id: userId } },
  });

  return callbackRequest(`/auth/callback?next=%2Ftoday&state=${STATE}&token=one-time`);
}

describe("failed callback recovery", () => {
  it("ends a second failed callback instead of starting another automatic sign-in", async () => {
    const response = await verifyOneTimeTokenCallback(
      callbackRequest("/auth/callback?error=auth&token=bad&next=%2Fplan"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("allows one retry, preserves a safe destination, and rejects an open redirect", async () => {
    const first = await verifyOneTimeTokenCallback(callbackRequest("/auth/callback?next=%2Fplan"));
    expect(first.headers.get("location")).toBe("/login?error=auth&next=%2Fplan");

    const unsafe = await verifyOneTimeTokenCallback(
      callbackRequest("/auth/callback?next=https%3A%2F%2Fevil.example"),
    );

    expect(unsafe.headers.get("location")).toBe("/login?error=auth");
  });
});

describe("signed-in callback", () => {
  it("reports the completed sign-in for the account after the response, from the app's browser", async () => {
    const settle = runDeferredWork();
    const user = await userFixture();
    vi.mocked(headers).mockResolvedValue(new Headers({ "user-agent": BROWSER_USER_AGENT }));

    const response = await verifyOneTimeTokenCallback(signedInCallback(user.id));

    expect(response.headers.get("location")).toBe("/today");
    expect(response.headers.getSetCookie()).toContain("session=signed; Path=/");
    expect(trackServerEvent).not.toHaveBeenCalled();

    await settle();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Sign In Completed",
        shared: expect.objectContaining({ locale: "pt", platform: "web" }),
      }),
    );
  });

  it("sends nothing when this browser said no, even for an account that said yes", async () => {
    const settle = runDeferredWork();
    const user = await userFixture();
    await learningProfileFixture({ shareUsageData: true, userId: user.id });

    vi.mocked(cookies).mockResolvedValue(
      new Map([[USAGE_DATA_COOKIE, { name: USAGE_DATA_COOKIE, value: "off" }]]) as never,
    );

    await verifyOneTimeTokenCallback(signedInCallback(user.id));
    await settle();

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});
