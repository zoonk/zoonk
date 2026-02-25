import {
  unstable_doesMiddlewareMatch as doesMiddlewareMatch,
  getRedirectUrl,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { config, proxy } from "./proxy";

describe("next.js proxy", () => {
  test("doesn't match API routes", () => {
    expect(doesMiddlewareMatch({ config, url: "/api/hello" })).toBeFalsy();
  });

  test("doesn't match static files", () => {
    expect(doesMiddlewareMatch({ config, url: "/favicon.ico" })).toBeFalsy();
  });

  test("doesn't match _next paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/_next/static/file.js" })).toBeFalsy();
  });

  test("doesn't match _vercel paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/_vercel/insights/view" })).toBeFalsy();
  });

  test("doesn't match .well-known paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/.well-known/workflow/whatever" })).toBeFalsy();
  });

  test("matches well-known course paths", () => {
    expect(doesMiddlewareMatch({ config, url: "/c/my-well-known-course" })).toBeTruthy();

    expect(doesMiddlewareMatch({ config, url: "/c/well-known-course/en" })).toBeTruthy();
  });

  test("doesn't match paths starting with 149e (BotID paths)", () => {
    // https://x.com/andrewqu/status/1988640986520842672?s=20
    expect(doesMiddlewareMatch({ config, url: "/149eabcd" })).toBeFalsy();
  });

  test("remove default locale from URL", () => {
    const request = new NextRequest("https://zoonk.com/en/some/page");
    const response = proxy(request);

    expect(getRedirectUrl(response)).toBe("https://zoonk.com/some/page");
  });
});
