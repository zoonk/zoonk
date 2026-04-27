import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { countSitemapChapters, listSitemapChapters } from "./chapters";
import { SITEMAP_BATCH_SIZE } from "./courses";

function lastPage(count: number): number {
  return Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE) - 1, 0);
}

describe(countSitemapChapters, () => {
  test("returns a positive count", async () => {
    const count = await countSitemapChapters();
    expect(count).toBeGreaterThan(0);
  });
});

describe(listSitemapChapters, () => {
  test("returns correct slug hierarchy", async () => {
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

    expect(found).toEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      updatedAt: expect.any(Date),
    });
  });

  test("excludes unpublished chapters", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
    });

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

  test("excludes chapters from personal courses without an organization", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: null,
    });

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

  test("excludes chapters from non-brand organizations", async () => {
    const org = await organizationFixture({ kind: "personal" });

    const course = await courseFixture({
      isPublished: true,
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

    expect(found).toBeUndefined();
  });

  test("excludes chapters from unpublished courses", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: false,
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

    expect(found).toBeUndefined();
  });
});
