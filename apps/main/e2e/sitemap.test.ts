import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { expect, test } from "./fixtures";

type SitemapResource = "courses" | "library-chapters" | "library-lessons";

/**
 * Finds the `<url>` entry holding `expectedUrl`, checking every sitemap page because a new fixture
 * may sort after the first 5,000 URLs in a long-lived E2E database. Next.js returns 404 for IDs
 * beyond generateSitemaps(), while page zero must always exist.
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

  if (entry || !body.includes("<url>")) {
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
  test("lists only matching locale URLs for indexable course content, with when they last changed", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "pt-BR",
      organizationId: organization.id,
      slug: `e2e-sitemap-course-${uniqueId}`,
    });

    const chapter = await libraryChapterFixture({
      homeCourseId: course.id,
      language: "pt-BR",
      slug: `e2e-sitemap-chapter-${uniqueId}`,
    });

    const lesson = await libraryLessonFixture({
      homeChapterId: chapter.id,
      language: "pt-BR",
      slug: `e2e-sitemap-lesson-${uniqueId}`,
    });

    const coursePath = `/b/${organization.slug}/c/${course.slug}`;
    const chapterPath = `${coursePath}/ch/${chapter.slug}`;
    const lessonPath = `${chapterPath}/l/${lesson.slug}`;

    const entries = await Promise.all([
      findPortugueseSitemapEntry({ path: coursePath, resource: "courses" }),
      findPortugueseSitemapEntry({ path: chapterPath, resource: "library-chapters" }),
      findPortugueseSitemapEntry({ path: lessonPath, resource: "library-lessons" }),
    ]);

    const lastChanged = expect.stringContaining("<lastmod>");
    expect(entries).toStrictEqual([lastChanged, lastChanged, lastChanged]);
  });

  test("leaves out a shared course whose page details aren't written yet, with its chapters", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await getAiOrganization();

    // A shared course a guest's goal made: published with its outline, its details still to come.
    const course = await courseFixture({
      description: null,
      isPublished: true,
      language: "pt-BR",
      organizationId: organization.id,
      slug: `e2e-sitemap-undescribed-${uniqueId}`,
    });

    const chapter = await libraryChapterFixture({
      homeCourseId: course.id,
      language: "pt-BR",
      slug: `e2e-sitemap-undescribed-chapter-${uniqueId}`,
    });

    const coursePath = `/b/${organization.slug}/c/${course.slug}`;

    const entries = await Promise.all([
      findPortugueseSitemapEntry({ path: coursePath, resource: "courses" }),
      findPortugueseSitemapEntry({
        path: `${coursePath}/ch/${chapter.slug}`,
        resource: "library-chapters",
      }),
    ]);

    expect(entries).toStrictEqual([undefined, undefined]);
  });
});
