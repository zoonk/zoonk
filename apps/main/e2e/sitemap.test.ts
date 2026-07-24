import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

/**
 * Checks each generated lesson sitemap page because a new fixture may sort
 * after the first 5,000 lesson URLs in a long-lived E2E database.
 */
async function lessonSitemapContainsUrl({
  expectedUrl,
  page = 0,
}: {
  expectedUrl: string;
  page?: number;
}): Promise<boolean> {
  const response = await fetch(`${getBaseURL()}/sitemaps/lessons/sitemap/${page}.xml`);
  expect(response.status).toBe(200);

  const body = await response.text();
  expect(body).toContain("<urlset");

  if (body.includes(expectedUrl)) {
    return true;
  }

  if (!body.includes("<url>")) {
    return false;
  }

  return lessonSitemapContainsUrl({ expectedUrl, page: page + 1 });
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

test.describe("lesson sitemaps", () => {
  test("returns canonical URLs for indexable lessons", async () => {
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

    const expectedUrl = `<loc>https://www.zoonk.com/pt/b/${organization.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}</loc>`;
    expect(await lessonSitemapContainsUrl({ expectedUrl })).toBe(true);
  });
});
