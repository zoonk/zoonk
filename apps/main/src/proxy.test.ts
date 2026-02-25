import { LOCALE_COOKIE } from "@zoonk/utils/locale";
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

  test("redirects home page to language-specific URL", () => {
    const request = new NextRequest("https://zoonk.com");
    request.cookies.set(LOCALE_COOKIE, "pt");
    const response = proxy(request);

    expect(getRedirectUrl(response)).toBe("https://zoonk.com/pt");
  });

  test("redirects nested page to language-specific URL", () => {
    const request = new NextRequest("https://zoonk.com/some/page");
    request.cookies.set(LOCALE_COOKIE, "pt");
    const response = proxy(request);

    expect(getRedirectUrl(response)).toBe("https://zoonk.com/some/page");
  });

  test("don't redirect home page if using default locale", () => {
    const request = new NextRequest("https://zoonk.com");
    request.cookies.set(LOCALE_COOKIE, "en");
    const response = proxy(request);

    expect(getRedirectUrl(response)).toBeFalsy();
  });

  test("don't redirect nested page if using default locale", () => {
    const request = new NextRequest("https://zoonk.com/some/page");
    request.cookies.set(LOCALE_COOKIE, "en");
    const response = proxy(request);

    expect(getRedirectUrl(response)).toBeFalsy();
  });

  test("remove default locale from URL", () => {
    const request = new NextRequest("https://zoonk.com/en/some/page");
    const response = proxy(request);

    expect(getRedirectUrl(response)).toBe("https://zoonk.com/some/page");
  });
});
