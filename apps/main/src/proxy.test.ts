import { API_URL } from "@zoonk/utils/url";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import proxy, { config } from "./proxy";

/** Local adapter tests use a fake, unexpired provider token and never contact Vercel. */
const oidcToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString("base64url")}.test-signature`;

describe("catalog locale routing", () => {
  it.each([
    "/b/zoonk/c/computer-science",
    "/b/zoonk/c/computer-science/ch/basics",
    "/b/zoonk/c/computer-science/ch/basics/l/intro",
  ])("applies the saved locale to unprefixed catalog path %s", async (path) => {
    const request = new NextRequest(`https://www.zoonk.com${path}?review=true`, {
      headers: { "accept-language": "pt-BR", cookie: "ZOONK_LOCALE=de" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);

    expect(response.headers.get("location")).toBe(`https://www.zoonk.com/de${path}?review=true`);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("link")).toBeNull();
  });

  it("remembers an explicit course locale for subsequent navigation", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/pt/b/zoonk/c/ciencia-da-computacao-pt", {
        headers: { "accept-language": "fr-FR", cookie: "ZOONK_LOCALE=de" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("pt");
    expect(response.cookies.get("ZOONK_LOCALE")?.value).toBe("pt");
    expect(response.headers.get("link")).toBeNull();
  });

  it("detects the browser language on catalog routes without a saved locale", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/b/ai/c/spanish-fr", {
        headers: { "accept-language": "fr-FR" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.zoonk.com/fr/b/ai/c/spanish-fr");
  });

  it("keeps English catalog URLs unprefixed without advertising other UI locales as editions", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/b/ai/c/computer-science", {
        headers: { "accept-language": "en-US" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("link")).toBeNull();
  });

  it("continues applying the saved preference outside course routes", async () => {
    const response = await proxy(
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

describe("protected preview API proxy", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_OIDC_TOKEN", oidcToken);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards bearer auth and query parameters while replacing platform auth and removing cookies", async () => {
    const response = await proxy(
      new NextRequest("https://main.zoonk.dev/v1/generations?startIndex=4", {
        headers: {
          authorization: "Bearer user-token",
          "content-type": "application/json",
          cookie: "session=browser-cookie",
          origin: "https://main.zoonk.dev",
          "x-generation-visitor-id": "visitor-id",
          "x-vercel-oidc-token": "untrusted-inbound-token",
          "x-vercel-protection-bypass": "untrusted-bypass",
          "x-vercel-trusted-oidc-idp-token": "untrusted-token",
        },
        method: "POST",
      }),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `${API_URL}/v1/generations?startIndex=4`,
    );

    expect(response.headers.get("x-middleware-request-authorization")).toBe("Bearer user-token");

    expect(response.headers.get("x-middleware-request-x-generation-visitor-id")).toBe("visitor-id");

    expect(response.headers.get("x-middleware-request-x-vercel-trusted-oidc-idp-token")).toBe(
      oidcToken,
    );

    expect(response.headers.get("x-middleware-request-cookie")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-vercel-protection-bypass")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-vercel-oidc-token")).toBeNull();
  });

  it.each([undefined, "https://other.example"])(
    "rejects unsafe origin %s before retrieving platform credentials",
    async (origin) => {
      const response = await proxy(
        new NextRequest("https://main.zoonk.dev/v1/feedback", {
          headers: origin ? { origin } : {},
          method: "POST",
        }),
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it.each(["production", "development"])(
    "does not proxy API requests in %s",
    async (environment) => {
      vi.stubEnv("VERCEL_ENV", environment);
      const response = await proxy(new NextRequest("https://www.zoonk.com/v1/generations"));
      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it.each(["/v1/auth", "/v1/auth/sign-in/social"])(
    "keeps central auth path %s off the proxy",
    async (path) => {
      const response = await proxy(new NextRequest(`https://main.zoonk.dev${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it("matches API paths containing dots and bypasses locale redirects", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/v1/questions/question.id/answers" })).toBe(
      true,
    );
  });
});
