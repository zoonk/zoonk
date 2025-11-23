import {
  unstable_doesMiddlewareMatch as doesMiddlewareMatch,
  getRedirectUrl,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { config, proxy } from "./proxy";

test("doesn't match API routes", () => {
  expect(doesMiddlewareMatch({ config, url: "/api/hello" })).toBe(false);
});

test("doesn't match static files", () => {
  expect(doesMiddlewareMatch({ config, url: "/favicon.ico" })).toBe(false);
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

test("redirects home page to language-specific URL", () => {
  const request = new NextRequest("https://zoonk.com");
  request.cookies.set("NEXT_LOCALE", "pt");
  const response = proxy(request);

  expect(getRedirectUrl(response)).toBe("https://zoonk.com/pt");
});

test("redirects nested page to language-specific URL", () => {
  const request = new NextRequest("https://zoonk.com/some/page");
  request.cookies.set("NEXT_LOCALE", "pt");
  const response = proxy(request);

  expect(getRedirectUrl(response)).toBe("https://zoonk.com/pt/some/page");
});

test("don't redirect home page if using default locale", () => {
  const request = new NextRequest("https://zoonk.com");
  request.cookies.set("NEXT_LOCALE", "en");
  const response = proxy(request);

  expect(getRedirectUrl(response)).toBeFalsy();
});

test("don't redirect nested page if using default locale", () => {
  const request = new NextRequest("https://zoonk.com/some/page");
  request.cookies.set("NEXT_LOCALE", "en");
  const response = proxy(request);

  expect(getRedirectUrl(response)).toBeFalsy();
});

test("remove default locale from URL", () => {
  const request = new NextRequest("https://zoonk.com/en/some/page");
  const response = proxy(request);

  expect(getRedirectUrl(response)).toBe("https://zoonk.com/some/page");
});
