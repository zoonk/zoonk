import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { SITEMAP_BATCH_SIZE } from "./courses";
import { countSitemapLessons, listSitemapLessons } from "./lessons";

function lastPage(count: number): number {
  return Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE) - 1, 0);
}

describe(countSitemapLessons, () => {
  test("returns a positive count", async () => {
    const count = await countSitemapLessons();
    expect(count).toBeGreaterThan(0);
  });
});

describe(listSitemapLessons, () => {
  test("returns correct full path slugs", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "pt",
      organizationId: org.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapLessons();
    const lessons = await listSitemapLessons(lastPage(count));
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      language: "pt",
      lessonSlug: lesson.slug,
      updatedAt: expect.any(Date),
    });
  });

  test("excludes unpublished lessons", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: org.id,
    });

    const count = await countSitemapLessons();
    const lessons = await listSitemapLessons(lastPage(count));
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toBeUndefined();
  });

  test("excludes lessons from personal courses without an organization", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: null,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: null,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: null,
    });

    const count = await countSitemapLessons();
    const lessons = await listSitemapLessons(lastPage(count));
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toBeUndefined();
  });

  test("excludes lessons from non-brand organizations", async () => {
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

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapLessons();
    const lessons = await listSitemapLessons(lastPage(count));
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toBeUndefined();
  });

  test("excludes lessons from unpublished chapters", async () => {
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

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapLessons();
    const lessons = await listSitemapLessons(lastPage(count));
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toBeUndefined();
  });

  test("excludes lessons from unpublished courses", async () => {
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

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapLessons();
    const lessons = await listSitemapLessons(lastPage(count));
    const found = lessons.find((item) => item.lessonSlug === lesson.slug);

    expect(found).toBeUndefined();
  });
});
