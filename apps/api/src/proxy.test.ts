import { unstable_doesMiddlewareMatch as doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { config, proxy } from "./proxy";

describe("matcher", () => {
  test("matches nested /v1 paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/v1/organization/list" })).toBe(
      true,
    );

    expect(doesMiddlewareMatch({ config, url: "/v1/get-session" })).toBe(true);
  });

  test("doesn't match _next paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/_next/static/file.js" })).toBe(
      false,
    );
  });

  test("doesn't match _vercel paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/_vercel/insights/view" })).toBe(
      false,
    );
  });

  test("doesn't match paths starting with 149e (BotID paths)", () => {
    // https://x.com/andrewqu/status/1988640986520842672?s=20
    expect(doesMiddlewareMatch({ config, url: "/149eabcd" })).toBe(false);
  });
});

describe("headers", () => {
  test("sets allowed origin for wildcard zoonk.com domains", () => {
    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: { origin: "https://app.zoonk.com" },
    });

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowCredentials).toBe("true");
    expect(allowOrigin).toBe("https://app.zoonk.com");
  });

  test("sets allowed origin for appleid.apple.com", () => {
    const request = new NextRequest(
      "https://auth.zoonk.com/v1/callback/apple",
      {
        headers: { origin: "https://appleid.apple.com" },
      },
    );

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowCredentials).toBe("true");
    expect(allowOrigin).toBe("https://appleid.apple.com");
  });

  test("sets allowed origins for zoonk.com", () => {
    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: { origin: "https://zoonk.com" },
    });

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowCredentials).toBe("true");
    expect(allowOrigin).toBe("https://zoonk.com");
  });

  test("sets allowed origins for vercel preview deployments", () => {
    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: { origin: "https://zoonk-pr-123-zoonk.vercel.app" },
    });

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowCredentials).toBe("true");
    expect(allowOrigin).toBe("https://zoonk-pr-123-zoonk.vercel.app");
  });

  test("doesn't set allowed origin for untrusted origins", () => {
    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: { origin: "https://evil.com" },
    });

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowCredentials).toBeNull();
    expect(allowOrigin).toBeNull();
  });

  test("doesn't set allowed origin for urls containing zoonk.com but not matching", () => {
    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: { origin: "https://notzoonk.com" },
    });

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowCredentials).toBeNull();
    expect(allowOrigin).toBeNull();
  });

  test("handles OPTIONS preflight for allowed origins", () => {
    const origin = "https://app.zoonk.com";

    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: { origin },
      method: "OPTIONS",
    });

    const response = proxy(request);

    const allowCredentials = response.headers.get(
      "Access-Control-Allow-Credentials",
    );
    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");
    const allowMethods = response.headers.get("Access-Control-Allow-Methods");
    const allowHeaders = response.headers.get("Access-Control-Allow-Headers");

    expect(allowCredentials).toBe("true");
    expect(allowOrigin).toBe(origin);
    expect(allowMethods).not.toBeNull();
    expect(allowMethods?.includes("POST")).toBe(true);
    expect(allowHeaders).not.toBeNull();
  });

  test("rejects OPTIONS preflight for untrusted origins", () => {
    const request = new NextRequest("https://auth.zoonk.com/v1/get-session", {
      headers: {
        "access-control-request-method": "POST",
        origin: "https://evil.com",
      },
      method: "OPTIONS",
    });

    const response = proxy(request);

    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");

    expect(allowOrigin).toBeNull();
  });
});
