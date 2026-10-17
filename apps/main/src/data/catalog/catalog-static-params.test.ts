import { randomUUID } from "node:crypto";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { describe, expect, it } from "vitest";
import {
  getChapterStaticParams,
  getCourseStaticParams,
  getLessonStaticParams,
} from "./catalog-static-params";

/** A unique language keeps each test's catalog apart from the courses other tests create. */
function createTestLanguage() {
  return randomUUID().slice(0, 10);
}

describe("catalog static params", () => {
  it("writes a listed course's page, its first chapter and the first lesson of its first chapter with lessons", async () => {
    const language = createTestLanguage();

    const { chapters, course, lessons, organization } = await catalogCourseFixture({
      language,
      lessonCounts: [0, 2],
    });

    const route = { brandSlug: organization.slug, courseSlug: course.slug };

    await expect(getCourseStaticParams(language)).resolves.toStrictEqual([route]);

    await expect(getChapterStaticParams(language)).resolves.toStrictEqual([
      { ...route, chapterSlug: chapters[0]?.slug },
    ]);

    await expect(getLessonStaticParams(language)).resolves.toStrictEqual([
      { ...route, chapterSlug: chapters[1]?.slug, lessonSlug: lessons[1]?.[0]?.slug },
    ]);
  });

  it("falls back to the unlisted address for a language without listed courses", async () => {
    const language = createTestLanguage();

    await expect(getCourseStaticParams(language)).resolves.toStrictEqual([
      { brandSlug: "-", courseSlug: "-" },
    ]);

    await expect(getChapterStaticParams(language)).resolves.toStrictEqual([
      { brandSlug: "-", chapterSlug: "-", courseSlug: "-" },
    ]);

    await expect(getLessonStaticParams(language)).resolves.toStrictEqual([
      { brandSlug: "-", chapterSlug: "-", courseSlug: "-", lessonSlug: "-" },
    ]);
  });
});
