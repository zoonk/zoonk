import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { SITEMAP_FIXTURES } from "./e2e-data";
import { expect, test } from "./fixtures";

type SitemapResource = "courses" | "library-chapters" | "library-lessons";

/**
 * Finds the `<url>` entry holding `expectedUrl`, checking every sitemap page: a row's page comes
 * from its id, and a page can be empty. Next.js returns 404 for IDs beyond generateSitemaps(),
 * while page zero always exists.
 */
async function findSitemapEntry({
  expectedUrl,
  page = 0,
  resource,
}: {
  expectedUrl: string;
  page?: number;
  resource: SitemapResource;
}): Promise<string | undefined> {
  const response = await fetch(`${getBaseURL()}/sitemaps/${resource}/sitemap/${page}.xml`);

  if (page > 0 && response.status === 404) {
    return undefined;
  }

  expect(response.status).toBe(200);

  const body = await response.text();
  expect(body).toContain("<urlset");

  const entry = body.split("<url>").find((item) => item.includes(expectedUrl));

  if (entry) {
    return entry;
  }

  return findSitemapEntry({ expectedUrl, page: page + 1, resource });
}

/** The content's Portuguese URL is listed and its unprefixed one isn't; returns its entry. */
async function findPortugueseSitemapEntry({
  path,
  resource,
}: {
  path: string;
  resource: SitemapResource;
}) {
  const [portuguese, unprefixed] = await Promise.all([
    findSitemapEntry({ expectedUrl: `<loc>https://www.zoonk.com/pt${path}</loc>`, resource }),
    findSitemapEntry({ expectedUrl: `<loc>https://www.zoonk.com${path}</loc>`, resource }),
  ]);

  expect(unprefixed).toBeUndefined();
  return portuguese;
}

test.describe("robots.txt", () => {
  test("disallows private pages", async () => {
    const response = await fetch(`${getBaseURL()}/robots.txt`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("Disallow: /auth/");
    expect(body).toContain("Disallow: /login");
    expect(body).toContain("Disallow: /*/login");
    expect(body).toContain("Disallow: /learn/");
    expect(body).toContain("Disallow: /*/learn/");
    expect(body).toContain("Sitemap: https://www.zoonk.com/sitemaps/courses/sitemap/0.xml");

    expect(body).toContain(
      "Sitemap: https://www.zoonk.com/sitemaps/library-chapters/sitemap/0.xml",
    );

    expect(body).toContain("Sitemap: https://www.zoonk.com/sitemaps/library-lessons/sitemap/0.xml");
  });
});

test.describe("sitemap.xml", () => {
  test("returns static page URLs", async () => {
    const response = await fetch(`${getBaseURL()}/sitemap.xml`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("https://www.zoonk.com");
    expect(body).toContain("<loc>https://www.zoonk.com/courses</loc>");
    expect(body).toContain("<loc>https://www.zoonk.com/pt/courses</loc>");
    expect(body).toContain("<loc>https://www.zoonk.com/courses/science</loc>");
    expect(body).toContain("<loc>https://www.zoonk.com/pt/courses/science</loc>");
    expect(body).toContain("<loc>https://www.zoonk.com/pricing</loc>");
    expect(body).toContain("<loc>https://www.zoonk.com/pt/pricing</loc>");
  });
});

test.describe("catalog sitemaps", () => {
  const coursePath = `/b/${SITEMAP_FIXTURES.organizationSlug}/c/${SITEMAP_FIXTURES.courseSlug}`;
  const chapterPath = `${coursePath}/ch/${SITEMAP_FIXTURES.chapterSlug}`;

  const undescribedPath = `/b/${SITEMAP_FIXTURES.organizationSlug}/c/${SITEMAP_FIXTURES.undescribedCourseSlug}`;

  test("lists only matching locale URLs for indexable course content, with when they last changed", async () => {
    const entries = await Promise.all([
      findPortugueseSitemapEntry({ path: coursePath, resource: "courses" }),
      findPortugueseSitemapEntry({ path: chapterPath, resource: "library-chapters" }),
      findPortugueseSitemapEntry({
        path: `${chapterPath}/l/${SITEMAP_FIXTURES.lessonSlug}`,
        resource: "library-lessons",
      }),
    ]);

    const lastChanged = expect.stringContaining("<lastmod>");
    expect(entries).toStrictEqual([lastChanged, lastChanged, lastChanged]);
  });

  test("leaves out a shared course whose page details aren't written yet, with its chapters", async () => {
    const entries = await Promise.all([
      findPortugueseSitemapEntry({ path: undescribedPath, resource: "courses" }),
      findPortugueseSitemapEntry({
        path: `${undescribedPath}/ch/${SITEMAP_FIXTURES.undescribedChapterSlug}`,
        resource: "library-chapters",
      }),
    ]);

    expect(entries).toStrictEqual([undefined, undefined]);
  });
});
