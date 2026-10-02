import { ACCOUNT_MARKER_COOKIE } from "@zoonk/auth/cookies";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy, { config } from "./proxy";

describe("catalog locale routing", () => {
  it.each([
    "/b/zoonk/c/computer-science",
    "/b/zoonk/c/computer-science/ch/basics",
    "/b/zoonk/c/computer-science/ch/basics/l/intro",
  ])("applies the saved locale to unprefixed catalog path %s", (path) => {
    const request = new NextRequest(`https://www.zoonk.com${path}?review=true`, {
      headers: { "accept-language": "pt-BR", cookie: "ZOONK_LOCALE=de" },
    });

    const response = proxy(request);

    expect(response.status).toBe(307);

    expect(response.headers.get("location")).toBe(`https://www.zoonk.com/de${path}?review=true`);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("link")).toBeNull();
  });

  it("remembers an explicit course locale for subsequent navigation", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/pt/b/zoonk/c/ciencia-da-computacao-pt", {
        headers: { "accept-language": "fr-FR", cookie: "ZOONK_LOCALE=de" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("pt");
    expect(response.cookies.get("ZOONK_LOCALE")?.value).toBe("pt");
    expect(response.headers.get("link")).toBeNull();
  });

  it("detects the browser language on catalog routes without a saved locale", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/b/ai/c/spanish-fr", {
        headers: { "accept-language": "fr-FR" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.zoonk.com/fr/b/ai/c/spanish-fr");
  });

  it("keeps English catalog URLs unprefixed without advertising other UI locales as editions", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/b/ai/c/computer-science", {
        headers: { "accept-language": "en-US" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
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

describe("home page for learners and guests", () => {
  const SESSION = "better-auth.session_token=token.signature";
  const ACCOUNT = `${SESSION}; ${ACCOUNT_MARKER_COOKIE}=1`;

  it.each([
    ["/", "https://www.zoonk.com/today"],
    ["/pt", "https://www.zoonk.com/pt/today"],
    ["/de/", "https://www.zoonk.com/de/today"],
  ])("sends an account's session from %s to Today", (path, location) => {
    const response = proxy(
      new NextRequest(`https://www.zoonk.com${path}`, { headers: { cookie: ACCOUNT } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
  });

  it("recognizes the secure session cookie", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/", {
        headers: {
          cookie: `__Secure-better-auth.session_token=token.signature; ${ACCOUNT_MARKER_COOKIE}=1`,
        },
      }),
    );

    expect(response.headers.get("location")).toBe("https://www.zoonk.com/today");
  });

  it("keeps a guest on the home page, where they can continue where they left off", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/pt", {
        headers: { "accept-language": "pt-BR", cookie: SESSION },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("renders the visitor home page without a session, even with a stale account marker", () => {
    const visitor = proxy(
      new NextRequest("https://www.zoonk.com/", { headers: { "accept-language": "en-US" } }),
    );

    const staleMarker = proxy(
      new NextRequest("https://www.zoonk.com/", {
        headers: { "accept-language": "en-US", cookie: `${ACCOUNT_MARKER_COOKIE}=1` },
      }),
    );

    expect(visitor.status).toBe(200);
    expect(visitor.headers.get("location")).toBeNull();
    expect(staleMarker.status).toBe(200);
    expect(staleMarker.headers.get("location")).toBeNull();
  });

  it("leaves other pages alone for learners", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/courses", {
        headers: { "accept-language": "en-US", cookie: ACCOUNT },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("pricing for visitors and learners", () => {
  const SESSION_COOKIE = "better-auth.session_token=token.signature";

  it.each([
    ["/pricing", "https://www.zoonk.com/subscription"],
    ["/pt/pricing", "https://www.zoonk.com/pt/subscription"],
    ["/pricing/?ref=home", "https://www.zoonk.com/subscription?ref=home"],
  ])("sends a request with a session from %s to the subscription page", (path, location) => {
    const response = proxy(
      new NextRequest(`https://www.zoonk.com${path}`, { headers: { cookie: SESSION_COOKIE } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
  });

  it.each([
    ["/subscription", "https://www.zoonk.com/pricing"],
    ["/de/subscription", "https://www.zoonk.com/de/pricing"],
    ["/subscription?ref=email", "https://www.zoonk.com/pricing?ref=email"],
  ])("sends a visitor from %s to the public pricing page", (path, location) => {
    const response = proxy(
      new NextRequest(`https://www.zoonk.com${path}`, { headers: { "accept-language": "en-US" } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
  });

  it("renders the public pricing page for a visitor", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/pricing", { headers: { "accept-language": "en-US" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("renders the subscription page for a learner", () => {
    const response = proxy(
      new NextRequest("https://www.zoonk.com/subscription", {
        headers: { "accept-language": "en-US", cookie: SESSION_COOKIE },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy matcher", () => {
  it.each(["/", "/courses", "/en/courses", "/pt/courses"])(
    "matches localized page path %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/api/auth/session",
    "/auth/callback",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/_vercel/insights/view",
    "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/session",
    "/.well-known/workflow/v1/flow",
    "/favicon.ico",
    "/images/course.webp",
    "/sitemap.xml",
  ])("ignores non-localized path %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
