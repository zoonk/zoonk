import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { countSitemapChapters, listSitemapChapters } from "./chapters";
import { SITEMAP_BATCH_SIZE } from "./courses";

const sitemapChapterWhere = getPublishedChapterWhere({
  chapterWhere: { generationStatus: "completed" },
  courseWhere: { organization: { kind: "brand" } },
});

/**
 * The sitemap tests run against a shared test database, so they must only assert
 * on rows they created. Counting by ID keeps this test stable when another test
 * inserts a sitemap-eligible chapter at the same time.
 */
function countCreatedSitemapChapters(chapterIds: string[]): Promise<number> {
  return prisma.chapter.count({
    where: { AND: [sitemapChapterWhere, { id: { in: chapterIds } }] },
  });
}

/**
 * Sitemap routes are split into fixed-size pages, so tests need the final page
 * number to find rows that were just inserted with the highest auto-incremented
 * IDs.
 */
function lastPage(count: number): number {
  return Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE) - 1, 0);
}

describe(countSitemapChapters, () => {
  it("returns a positive count", async () => {
    const count = await countSitemapChapters();
    expect(count).toBeGreaterThan(0);
  });

  it("only counts completed generated chapters", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapters = await Promise.all([
      chapterFixture({
        courseId: course.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
      }),
      chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
      }),
    ]);

    const chapterIds = chapters.map((chapter) => chapter.id);

    await expect(countCreatedSitemapChapters(chapterIds)).resolves.toBe(1);
  });
});

describe(listSitemapChapters, () => {
  it("returns correct slug hierarchy", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapChapters();
    const chapters = await listSitemapChapters(lastPage(count));
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toStrictEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      updatedAt: expect.any(Date),
    });
  });

  it("excludes unpublished chapters", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId: org.id,
    });

    const count = await countSitemapChapters();
    const chapters = await listSitemapChapters(lastPage(count));
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toBeUndefined();
  });

  it("excludes chapters from personal courses without an organization", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: null });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: null,
    });

    const count = await countSitemapChapters();
    const chapters = await listSitemapChapters(lastPage(count));
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toBeUndefined();
  });

  it("excludes chapters from non-brand organizations", async () => {
    const org = await organizationFixture({ kind: "personal" });

    const course = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapChapters();
    const chapters = await listSitemapChapters(lastPage(count));
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toBeUndefined();
  });

  it("excludes chapters from unpublished courses", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({ isPublished: false, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapChapters();
    const chapters = await listSitemapChapters(lastPage(count));
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toBeUndefined();
  });
});
