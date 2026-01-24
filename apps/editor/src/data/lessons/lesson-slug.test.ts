import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { lessonSlugExists } from "./lesson-slug";

describe("lessonSlugExists()", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
  });

  test("returns true when slug exists in same chapter", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

    const exists = await lessonSlugExists({
      chapterId: chapter.id,
      slug: lesson.slug,
    });

    expect(exists).toBeTruthy();
  });

  test("returns false when slug does not exist", async () => {
    const exists = await lessonSlugExists({
      chapterId: chapter.id,
      slug: "non-existent-slug",
    });

    expect(exists).toBeFalsy();
  });

  test("returns false when slug exists but chapter differs", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      }),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      }),
    ]);

    const lesson = await lessonFixture({
      chapterId: chapter1.id,
      language: chapter1.language,
      organizationId: organization.id,
    });

    const exists = await lessonSlugExists({
      chapterId: chapter2.id,
      slug: lesson.slug,
    });

    expect(exists).toBeFalsy();
  });
});
