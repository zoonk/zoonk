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

  test("returns true when slug exists for same language and org", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

    const exists = await lessonSlugExists({
      language: lesson.language,
      orgSlug: organization.slug,
      slug: lesson.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const exists = await lessonSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but language differs", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: "en",
      organizationId: organization.id,
    });

    const exists = await lessonSlugExists({
      language: "pt",
      orgSlug: organization.slug,
      slug: lesson.slug,
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but organization differs", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });
    const lesson = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherChapter.language,
      organizationId: otherOrg.id,
    });

    const exists = await lessonSlugExists({
      language: lesson.language,
      orgSlug: organization.slug,
      slug: lesson.slug,
    });

    expect(exists).toBe(false);
  });
});
