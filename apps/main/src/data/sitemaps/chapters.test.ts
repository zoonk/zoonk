import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { countSitemapChapters, listSitemapChapters } from "./chapters";
import { SITEMAP_BATCH_SIZE } from "./courses";

const sitemapChapterWhere = getPublishedChapterWhere({
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

/** UUID fixtures can appear on any sitemap page in the shared test database. */
async function listAllSitemapChapters() {
  const count = await countSitemapChapters();
  const pageCount = Math.ceil(count / SITEMAP_BATCH_SIZE);

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, page) => listSitemapChapters(page)),
  );

  return pages.flat();
}

describe(countSitemapChapters, () => {
  it("returns a positive count", async () => {
    const count = await countSitemapChapters();
    expect(count).toBeGreaterThan(0);
  });

  it("counts published chapters regardless of generation status", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapters = await Promise.all(
      (["pending", "running", "completed", "failed"] as const).map((generationStatus) =>
        chapterFixture({
          courseId: course.id,
          generationStatus,
          isPublished: true,
          organizationId: organization.id,
        }),
      ),
    );

    const chapterIds = chapters.map((chapter) => chapter.id);

    await expect(countCreatedSitemapChapters(chapterIds)).resolves.toBe(4);
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

    const chapters = await listAllSitemapChapters();
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toStrictEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      language: "es",
      updatedAt: expect.any(Date),
    });
  });

  it.each(["pending", "running", "failed"] as const)(
    "includes published %s chapters",
    async (generationStatus) => {
      const organization = await organizationFixture({ kind: "brand" });
      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus,
        isPublished: true,
        organizationId: organization.id,
      });

      const chapters = await listAllSitemapChapters();
      const found = chapters.find((item) => item.chapterSlug === chapter.slug);

      expect(found).toBeDefined();
    },
  );

  it("excludes unpublished chapters", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId: org.id,
    });

    const chapters = await listAllSitemapChapters();
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

    const chapters = await listAllSitemapChapters();
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

    const chapters = await listAllSitemapChapters();
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

    const chapters = await listAllSitemapChapters();
    const found = chapters.find((item) => item.chapterSlug === chapter.slug);

    expect(found).toBeUndefined();
  });
});
