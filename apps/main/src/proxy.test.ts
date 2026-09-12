import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy, { config } from "./proxy";

describe("catalog locale routing", () => {
  it.each([
    "/b/zoonk/c/computer-science",
    "/b/zoonk/c/computer-science/ch/basics",
    "/b/zoonk/c/computer-science/ch/basics/l/intro",
  ])("keeps the unprefixed English canonical stable at %s", (path) => {
    const request = new NextRequest(`https://www.zoonk.com${path}?edition=original`, {
      headers: { "accept-language": "pt-BR", cookie: "ZOONK_LOCALE=de" },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `https://www.zoonk.com/en${path}?edition=original`,
    );

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("link")).toBeNull();
  });

  it("honors an explicit course locale without overwriting the saved preference", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/pt/b/zoonk/c/ciencia-da-computacao-pt", {
        headers: { "accept-language": "fr-FR", cookie: "ZOONK_LOCALE=de" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("pt");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("link")).toBeNull();
  });

  it("continues applying the saved preference outside course routes", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/courses", {
        headers: { "accept-language": "pt-BR", cookie: "ZOONK_LOCALE=de" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.zoonk.com/de/courses");
  });
});

describe("proxy matcher", () => {
  it.each([
    "/",
    "/courses",
    "/en/courses",
    "/pt/courses",
    "/start/learn/Python%203.12",
    "/pt/start/learn/Python%203.12",
  ])("matches localized page path %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each([
    "/api/auth/session",
    "/api/start/learn/file.json",
    "/auth/callback",
    "/_next/static/chunks/app.js",
    "/_next/start/learn/chunk.js",
    "/_next/image",
    "/_vercel/insights/view",
    "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/session",
    "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/start/learn/session.json",
    "/.well-known/workflow/v1/flow",
    "/favicon.ico",
    "/images/course.webp",
    "/sitemap.xml",
  ])("ignores non-localized path %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe("legacy learning request encoding", () => {
  it.each(["100%25%20attention", "paths%20and%20%2F%20slashes", "literal%20%2520"])(
    "moves the original encoded request to a temporary fragment: %s",
    (prompt) => {
      const path = `/start/learn/${prompt}`;
      const response = proxy(new NextRequest(`https://www.zoonk.com${path}`));
      expect(response.status).toBe(307);

      expect(response.headers.get("location")).toBe(
        `https://www.zoonk.com/start/learn#request=${prompt}`,
      );

      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("link")).toBeNull();
    },
  );

  it("preserves a percent sign while redirecting to the preferred locale", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/start/learn/100%25%20attention", {
        headers: { cookie: "ZOONK_LOCALE=pt" },
      }),
    );

    expect(response.headers.get("location")).toBe(
      "https://www.zoonk.com/pt/start/learn#request=100%25%20attention",
    );
  });

  it.each([
    ["en", "/start/learn"],
    ["pt", "/pt/start/learn"],
  ])("preserves an explicit %s locale over a different saved preference", (locale, path) => {
    const response = proxy(
      new NextRequest(`https://www.zoonk.com/${locale}/start/learn/100%25?from=bookmark`, {
        headers: { cookie: "ZOONK_LOCALE=de" },
      }),
    );

    expect(response.headers.get("location")).toBe(
      `https://www.zoonk.com${path}?from=bookmark#request=100%25`,
    );

    expect(response.cookies.get("ZOONK_LOCALE")?.value).toBe(locale);
  });
});
