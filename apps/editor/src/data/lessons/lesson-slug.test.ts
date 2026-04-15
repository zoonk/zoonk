import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { lessonSlugExists } from "./lesson-slug";

describe("lessonSlugExists()", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    const course = await courseFixture({ organizationId: fixture.organization.id });
    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("returns true when slug exists in same chapter", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

    const exists = await lessonSlugExists({
      chapterId: chapter.id,
      headers,
      slug: lesson.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const exists = await lessonSlugExists({
      chapterId: chapter.id,
      headers,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
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
      headers,
      slug: lesson.slug,
    });

    expect(exists).toBe(false);
  });

  test("returns false when the user cannot update the target chapter", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });
    const otherLesson = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherChapter.language,
      organizationId: otherOrg.id,
    });

    const exists = await lessonSlugExists({
      chapterId: otherChapter.id,
      headers,
      slug: otherLesson.slug,
    });

    expect(exists).toBe(false);
  });
});
