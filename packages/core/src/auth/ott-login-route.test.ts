import { API_URL } from "@zoonk/utils/url";
import { describe, expect, it } from "vitest";
import { startOneTimeTokenLogin } from "./ott-login-route";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "./ott-state";

function getAuthUrl(response: Response): URL {
  return new URL(response.headers.get("location") ?? "");
}

function getCallbackUrl(response: Response): URL {
  return new URL(getAuthUrl(response).searchParams.get("redirectTo") ?? "");
}

describe(startOneTimeTokenLogin, () => {
  it("binds a new state to the browser and sends it to central auth in its language", () => {
    const response = startOneTimeTokenLogin({
      callbackPath: "/auth/callback?next=%2Fpt%2Ftoday",
      locale: "pt",
      request: new Request("http://localhost:3000/pt/login"),
    });

    const authUrl = getAuthUrl(response);
    const callbackUrl = getCallbackUrl(response);
    const state = callbackUrl.searchParams.get("state");
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(`${authUrl.origin}${authUrl.pathname}`).toBe(new URL("/auth/login", API_URL).href);
    expect(authUrl.searchParams.get("locale")).toBe("pt");
    expect(authUrl.searchParams.get("error")).toBeNull();

    expect(`${callbackUrl.origin}${callbackUrl.pathname}`).toBe(
      "http://localhost:3000/auth/callback",
    );

    expect(callbackUrl.searchParams.get("next")).toBe("/pt/today");
    expect(state).toMatch(/^[\da-f]{64}$/u);
    expect(cookie).toContain(`${ONE_TIME_TOKEN_LOGIN_STATE_COOKIE}=${state};`);
    expect(cookie).toContain("Path=/;");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Secure");
  });

  it("comes back to the address the browser is on behind a proxy, over https", () => {
    const response = startOneTimeTokenLogin({
      callbackPath: "/auth/callback",
      locale: "en",
      request: new Request("http://localhost:3000/login", {
        headers: {
          "x-forwarded-host": "zoonk.com, internal.example",
          "x-forwarded-proto": "https",
        },
      }),
    });

    expect(getCallbackUrl(response).origin).toBe("https://zoonk.com");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("says on central auth that the last sign-in couldn't finish", () => {
    const response = startOneTimeTokenLogin({
      callbackPath: "/auth/callback",
      expired: true,
      locale: "en",
      request: new Request("http://localhost:3000/login"),
    });

    expect(getAuthUrl(response).searchParams.get("error")).toBe("expired");
    expect(getCallbackUrl(response).searchParams.get("error")).toBe("auth");
  });

  it("makes the router load the page as a document instead of binding a state", () => {
    const response = startOneTimeTokenLogin({
      callbackPath: "/auth/callback",
      locale: "en",
      request: new Request("http://localhost:3000/login", { headers: { rsc: "1" } }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
