import { randomUUID } from "node:crypto";
import { ACCOUNT_MARKER_COOKIE } from "@zoonk/auth/cookies";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy, { config } from "./proxy";

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

describe("home page for learners and guests", () => {
  const SESSION = "better-auth.session_token=token.signature";
  const ACCOUNT = `${SESSION}; ${ACCOUNT_MARKER_COOKIE}=1`;

  it.each([
    ["/", "https://www.zoonk.com/today"],
    ["/pt", "https://www.zoonk.com/pt/today"],
    ["/de/", "https://www.zoonk.com/de/today"],
  ])("sends an account's session from %s to Today", async (path, location) => {
    const response = await proxy(
      new NextRequest(`https://www.zoonk.com${path}`, { headers: { cookie: ACCOUNT } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
  });

  it("recognizes the secure session cookie", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/", {
        headers: {
          cookie: `__Secure-better-auth.session_token=token.signature; ${ACCOUNT_MARKER_COOKIE}=1`,
        },
      }),
    );

    expect(response.headers.get("location")).toBe("https://www.zoonk.com/today");
  });

  it("keeps a guest on the home page, where they can continue where they left off", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/pt", {
        headers: { "accept-language": "pt-BR", cookie: SESSION },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("renders the visitor home page without a session, even with a stale account marker", async () => {
    const visitor = await proxy(
      new NextRequest("https://www.zoonk.com/", { headers: { "accept-language": "en-US" } }),
    );

    const staleMarker = await proxy(
      new NextRequest("https://www.zoonk.com/", {
        headers: { "accept-language": "en-US", cookie: `${ACCOUNT_MARKER_COOKIE}=1` },
      }),
    );

    expect(visitor.status).toBe(200);
    expect(visitor.headers.get("location")).toBeNull();
    expect(staleMarker.status).toBe(200);
    expect(staleMarker.headers.get("location")).toBeNull();
  });

  it("leaves other pages alone for learners", async () => {
    const response = await proxy(
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
  ])("sends a request with a session from %s to the subscription page", async (path, location) => {
    const response = await proxy(
      new NextRequest(`https://www.zoonk.com${path}`, { headers: { cookie: SESSION_COOKIE } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
  });

  it.each([
    ["/subscription", "https://www.zoonk.com/pricing"],
    ["/de/subscription", "https://www.zoonk.com/de/pricing"],
    ["/subscription?ref=email", "https://www.zoonk.com/pricing?ref=email"],
  ])("sends a visitor from %s to the public pricing page", async (path, location) => {
    const response = await proxy(
      new NextRequest(`https://www.zoonk.com${path}`, { headers: { "accept-language": "en-US" } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
  });

  it("renders the public pricing page for a visitor", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/pricing", { headers: { "accept-language": "en-US" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("renders the subscription page for a learner", async () => {
    const response = await proxy(
      new NextRequest("https://www.zoonk.com/subscription", {
        headers: { "accept-language": "en-US", cookie: SESSION_COOKIE },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
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
        "https://www.zoonk.com/pt/_not-found",
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

  it("gives an unknown category the 404 page in the visitor's language", async () => {
    const [unknown, known] = await Promise.all([
      proxy(new NextRequest("https://www.zoonk.com/de/courses/not-a-category")),
      proxy(new NextRequest("https://www.zoonk.com/de/courses/science")),
    ]);

    expect(unknown.headers.get("x-middleware-rewrite")).toBe("https://www.zoonk.com/de/_not-found");
    expect(known.headers.get("x-middleware-rewrite")).toBeNull();
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
