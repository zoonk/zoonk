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

test("doesn't match paths already containing locale", () => {
  expect(doesMiddlewareMatch({ config, url: "/en/some/page" })).toBe(false);
});

test("redirects home page to /en when cookies are set", () => {
  const request = new NextRequest("https://zoonk.com");
  request.cookies.set("NEXT_LOCALE", "en");
  const response = proxy(request);

  expect(getRedirectUrl(response)).toBe("https://zoonk.com/en");
});

test("redirects home page to /en when Accept-Language is en-US", () => {
  const request = new NextRequest("https://zoonk.com", {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
  });

  const response = proxy(request);

  expect(getRedirectUrl(response)).toBe("https://zoonk.com/en");
});

test("redirects home page to /pt when Accept-Language is pt-BR", () => {
  const request = new NextRequest("https://zoonk.com", {
    headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
  });

  const response = proxy(request);

  expect(getRedirectUrl(response)).toBe("https://zoonk.com/pt");
});
