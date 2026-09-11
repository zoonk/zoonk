import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

/**
 * Checks every sitemap page because a new fixture may sort after the first
 * 5,000 URLs in a long-lived E2E database. Next.js returns 404 for IDs beyond
 * generateSitemaps(), while page zero must always exist.
 */
async function sitemapContainsUrl({
  expectedUrl,
  page = 0,
  resource,
}: {
  expectedUrl: string;
  page?: number;
  resource: "courses" | "chapters" | "lessons";
}): Promise<boolean> {
  const response = await fetch(`${getBaseURL()}/sitemaps/${resource}/sitemap/${page}.xml`);

  if (page > 0 && response.status === 404) {
    return false;
  }

  expect(response.status).toBe(200);

  const body = await response.text();
  expect(body).toContain("<urlset");

  if (body.includes(expectedUrl)) {
    return true;
  }

  if (!body.includes("<url>")) {
    return false;
  }

  return sitemapContainsUrl({ expectedUrl, page: page + 1, resource });
}

async function expectPortugueseSitemapUrl({
  path,
  resource,
}: {
  path: string;
  resource: "courses" | "chapters" | "lessons";
}) {
  const matches = await Promise.all([
    sitemapContainsUrl({ expectedUrl: `<loc>https://www.zoonk.com/pt${path}</loc>`, resource }),
    sitemapContainsUrl({ expectedUrl: `<loc>https://www.zoonk.com${path}</loc>`, resource }),
  ]);

  expect(matches).toStrictEqual([true, false]);
}

test.describe("robots.txt", () => {
  test("disallows private pages", async () => {
    const response = await fetch(`${getBaseURL()}/robots.txt`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("Disallow: /auth/");
    expect(body).toContain("Disallow: /login");
    expect(body).toContain("Disallow: /*/login");
    expect(body).toContain("Disallow: /generate/");
    expect(body).toContain("Disallow: /*/generate/");
    expect(body).toContain("Disallow: /*/p/");
    expect(body).toContain("Sitemap: https://www.zoonk.com/sitemaps/lessons/sitemap/0.xml");
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
  });
});

test.describe("course sitemaps", () => {
  test("returns valid sitemap XML", async () => {
    const response = await fetch(`${getBaseURL()}/sitemaps/courses/sitemap/0.xml`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("<urlset");
  });
});

test.describe("catalog sitemaps", () => {
  test("returns only matching locale URLs for indexable course content", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "pt-BR",
      organizationId: organization.id,
      slug: `e2e-sitemap-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      slug: `e2e-sitemap-chapter-${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      description: `E2E sitemap lesson description ${uniqueId}`,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      slug: `e2e-sitemap-lesson-${uniqueId}`,
      title: `E2E Sitemap Lesson ${uniqueId}`,
    });

    await stepFixture({ isPublished: true, lessonId: lesson.id });

    const coursePath = `/b/${organization.slug}/c/${course.slug}`;
    const chapterPath = `${coursePath}/ch/${chapter.slug}`;
    const lessonPath = `${chapterPath}/l/${lesson.slug}`;

    await Promise.all([
      expectPortugueseSitemapUrl({ path: coursePath, resource: "courses" }),
      expectPortugueseSitemapUrl({ path: chapterPath, resource: "chapters" }),
      expectPortugueseSitemapUrl({ path: lessonPath, resource: "lessons" }),
    ]);
  });

  test("excludes unsupported course languages throughout the catalog", async () => {
    const organization = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "ja-JP",
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const matches = await Promise.all(
      (["courses", "chapters", "lessons"] as const).map((resource) =>
        sitemapContainsUrl({ expectedUrl: course.slug, resource }),
      ),
    );

    expect(matches).toStrictEqual([false, false, false]);
  });
});
