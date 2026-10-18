import { randomUUID } from "node:crypto";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
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

  it("opens an explicit course locale without changing the saved one", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/pt/b/zoonk/c/ciencia-da-computacao-pt", {
        headers: { "accept-language": "fr-FR", cookie: "ZOONK_LOCALE=de" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("pt");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-middleware-set-cookie")).toBeNull();
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

/** A brand course, published or not, and its public path. */
async function createCourse({ isPublished }: { isPublished: boolean }) {
  const organization = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({ isPublished, organizationId: organization.id });

  return `/b/${organization.slug}/c/${course.slug}`;
}

describe("catalog pages that don't exist", () => {
  it("gives a page load of a course, chapter or lesson whose course doesn't exist the 404 page", async () => {
    const unpublished = await createCourse({ isPublished: false });
    const missing = `/b/ai/c/missing-${randomUUID()}`;

    const paths = [
      `/pt${missing}`,
      `/pt${missing}/ch/a-chapter`,
      `/pt${missing}/ch/a-chapter/l/a-lesson`,
      `/pt${unpublished}`,
    ];

    const responses = await Promise.all(
      paths.map((path) =>
        proxy(
          new NextRequest(`https://www.zoonk.com${path}`, {
            headers: { cookie: "ZOONK_LOCALE=pt" },
          }),
        ),
      ),
    );

    for (const response of responses) {
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "https://www.zoonk.com/pt/catalog-not-found",
      );
      // The 404 page reads the visitor's language from the header the locale middleware sets.
      expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("pt");
    }
  });

  it("serves a published course's pages, and leaves client navigations to the in-app 404", async () => {
    const published = await createCourse({ isPublished: true });
    const missing = `/b/ai/c/missing-${randomUUID()}`;

    const [page, chapter, navigation] = await Promise.all([
      proxy(new NextRequest(`https://www.zoonk.com/pt${published}`)),
      proxy(new NextRequest(`https://www.zoonk.com/pt${published}/ch/a-moved-chapter`)),
      proxy(new NextRequest(`https://www.zoonk.com/pt${missing}`, { headers: { rsc: "1" } })),
    ]);

    expect(page.headers.get("x-middleware-rewrite")).toBeNull();
    expect(chapter.headers.get("x-middleware-rewrite")).toBeNull();
    expect(navigation.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("gives an unknown category, or a path under a category, the 404 page in the visitor's language", async () => {
    const [unknown, deeper, known] = await Promise.all([
      proxy(new NextRequest("https://www.zoonk.com/de/courses/not-a-category")),
      proxy(new NextRequest("https://www.zoonk.com/de/courses/science/an-old-course")),
      proxy(new NextRequest("https://www.zoonk.com/de/courses/science")),
    ]);

    expect(unknown.headers.get("x-middleware-rewrite")).toBe(
      "https://www.zoonk.com/de/catalog-not-found",
    );

    expect(deeper.headers.get("x-middleware-rewrite")).toBe(
      "https://www.zoonk.com/de/catalog-not-found",
    );

    expect(known.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("pricing in the visitor's currency", () => {
  it("serves the pricing page's variant in the currency of the visitor's country at /pricing", async () => {
    const [brazil, germany, prefixed] = await Promise.all([
      proxy(
        new NextRequest("https://www.zoonk.com/pricing", {
          headers: { "accept-language": "en-US", "x-vercel-ip-country": "BR" },
        }),
      ),
      proxy(
        new NextRequest("https://www.zoonk.com/pricing?ref=nav", {
          headers: { "accept-language": "en-US", "x-vercel-ip-country": "DE" },
        }),
      ),
      proxy(
        new NextRequest("https://www.zoonk.com/pt/pricing", {
          headers: { "accept-language": "pt-BR", "x-vercel-ip-country": "BR" },
        }),
      ),
    ]);

    expect(brazil.headers.get("x-middleware-rewrite")).toBe("https://www.zoonk.com/en/pricing/brl");

    expect(germany.headers.get("x-middleware-rewrite")).toBe(
      "https://www.zoonk.com/en/pricing/eur?ref=nav",
    );

    expect(prefixed.headers.get("x-middleware-rewrite")).toBe(
      "https://www.zoonk.com/pt/pricing/brl",
    );

    expect(prefixed.headers.get("x-middleware-request-x-next-intl-locale")).toBe("pt");
  });

  it("reads the country from the browser's language without the platform's header", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/pt/pricing", {
        headers: { "accept-language": "pt-BR,pt;q=0.9" },
      }),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://www.zoonk.com/pt/pricing/brl",
    );
  });

  it("keeps the default currency's page, and other countries' default, at /pricing itself", async () => {
    const [unitedStates, unknown] = await Promise.all([
      proxy(
        new NextRequest("https://www.zoonk.com/pricing", {
          headers: { "accept-language": "en-US", "x-vercel-ip-country": "US" },
        }),
      ),
      proxy(
        new NextRequest("https://www.zoonk.com/pricing", {
          headers: { "accept-language": "en-US", "x-vercel-ip-country": "ZZ" },
        }),
      ),
    ]);

    expect(unitedStates.headers.get("x-middleware-rewrite")).toBe(
      "https://www.zoonk.com/en/pricing",
    );

    expect(unknown.headers.get("x-middleware-rewrite")).toBe("https://www.zoonk.com/en/pricing");
  });

  it("names no alternates for a currency variant asked for by its own address", async () => {
    const [variant, page] = await Promise.all([
      proxy(new NextRequest("https://www.zoonk.com/pt/pricing/brl")),
      proxy(new NextRequest("https://www.zoonk.com/pt/pricing")),
    ]);

    expect(variant.headers.get("link")).toBeNull();
    expect(page.headers.get("link")).toContain("/pricing");
  });

  it("leaves a language redirect alone", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/pricing", {
        headers: { cookie: "ZOONK_LOCALE=pt", "x-vercel-ip-country": "BR" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.zoonk.com/pt/pricing");
  });
});

describe("English by its prefix", () => {
  it.each([
    { cookie: "ZOONK_LOCALE=de", follows: "/de/privacy" },
    { cookie: "", follows: "/pt/privacy" },
  ])(
    "leads /en/… to the unprefixed address, which follows $follows",
    async ({ cookie, follows }) => {
      const headers = { "accept-language": "pt-BR", cookie };

      const [english, unprefixed] = await Promise.all([
        proxy(new NextRequest("https://www.zoonk.com/en/privacy", { headers })),
        proxy(new NextRequest("https://www.zoonk.com/privacy", { headers })),
      ]);

      expect(english.status).toBe(307);
      expect(english.headers.get("location")).toBe("https://www.zoonk.com/privacy");
      expect(english.headers.get("set-cookie")).toBeNull();
      expect(unprefixed.headers.get("location")).toBe(`https://www.zoonk.com${follows}`);
    },
  );
});

describe("static pages set no cookies", () => {
  const sessionCookie = `${getSessionCookieName({ secure: true })}=token`;

  it.each([
    "/",
    "/pricing",
    "/pt/pricing",
    "/privacy",
    "/terms",
    "/courses",
    "/courses/science",
    "/b/ai/c/computer-science",
  ])("answers %s without Set-Cookie, for a visitor and for a session", async (path) => {
    const language = path.startsWith("/pt") ? "pt-BR" : "en-US";

    const responses = await Promise.all(
      [undefined, sessionCookie].map((cookie) =>
        proxy(
          new NextRequest(`https://www.zoonk.com${path}`, {
            headers: {
              "accept-language": language,
              "x-vercel-ip-country": "BR",
              ...(cookie && { cookie }),
            },
          }),
        ),
      ),
    );

    for (const response of responses) {
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it.each(["/pt/pricing", "/pt/privacy", "/de/courses", "/pt", "/fr/b/ai/c/computer-science"])(
    "answers %s in another language than the saved one or the browser's without changing either",
    async (path) => {
      const [savedGerman, englishBrowser, sessionSavedSpanish] = await Promise.all([
        proxy(
          new NextRequest(`https://www.zoonk.com${path}`, {
            headers: { "accept-language": "en-US", cookie: "ZOONK_LOCALE=es" },
          }),
        ),
        proxy(
          new NextRequest(`https://www.zoonk.com${path}`, {
            headers: { "accept-language": "en-US" },
          }),
        ),
        proxy(
          new NextRequest(`https://www.zoonk.com${path}`, {
            headers: { "accept-language": "en-US", cookie: `ZOONK_LOCALE=es; ${sessionCookie}` },
          }),
        ),
      ]);

      for (const response of [savedGerman, englishBrowser, sessionSavedSpanish]) {
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(response.headers.get("x-middleware-set-cookie")).toBeNull();
      }
    },
  );
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
