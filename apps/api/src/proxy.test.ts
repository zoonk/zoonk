import { API_URL } from "@zoonk/utils/url";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const INTERNAL_API_ORIGIN = "http://localhost:4284";
const PORTLESS_API_ORIGIN = "http://fix-api-app-login-locale.api.zoonk.localhost:28474";
const FOREIGN_ORIGIN = "https://example.com";

describe(proxy, () => {
  it("passes auth Server Actions through when Portless uses a different public origin", () => {
    const request = new NextRequest(`${INTERNAL_API_ORIGIN}/auth/login?locale=en`, {
      headers: { cookie: "ZOONK_LOCALE=en", origin: PORTLESS_API_ORIGIN },
      method: "POST",
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes the main app's server calls that name the API's public origin behind Portless", () => {
    const request = new NextRequest(
      `${INTERNAL_API_ORIGIN}/v1/goal-understandings/id/generations`,
      {
        headers: { cookie: "better-auth.session_token=test", origin: new URL(API_URL).origin },
        method: "POST",
      },
    );

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("blocks cookie-authenticated API requests from a different origin", async () => {
    const request = new NextRequest(`${INTERNAL_API_ORIGIN}/v1/courses`, {
      headers: { cookie: "better-auth.session_token=test", origin: FOREIGN_ORIGIN },
      method: "POST",
    });

    const response = proxy(request);

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toStrictEqual({
      error: { code: "FORBIDDEN", message: "Same-origin request required" },
    });
  });

  it("blocks cookie-authenticated API requests even with a bearer authorization header", async () => {
    const request = new NextRequest(`${INTERNAL_API_ORIGIN}/v1/me`, {
      headers: {
        authorization: "Bearer invalid",
        cookie: "better-auth.session_token=test",
        origin: FOREIGN_ORIGIN,
      },
      method: "DELETE",
    });

    const response = proxy(request);

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toStrictEqual({
      error: { code: "FORBIDDEN", message: "Same-origin request required" },
    });
  });

  it("passes cookie-free bearer requests without an origin", () => {
    const request = new NextRequest(`${INTERNAL_API_ORIGIN}/v1/me`, {
      headers: { authorization: "Bearer test" },
      method: "DELETE",
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
