import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { getFirstCourseLesson } from "./get-first-course-lesson";

describe(getFirstCourseLesson, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns the published position-zero lesson in the intro chapter", async () => {
    const course = await courseFixture({ organizationId });

    const [introChapter, mainChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId,
        position: 0,
        slug: "intro",
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId,
        position: 1,
        slug: "main",
      }),
    ]);

    await Promise.all([
      lessonFixture({
        chapterId: introChapter.id,
        isPublished: true,
        organizationId,
        position: 1,
        slug: "second-intro-lesson",
      }),
      lessonFixture({
        chapterId: introChapter.id,
        isPublished: true,
        organizationId,
        position: 0,
        slug: "first-intro-lesson",
      }),
      lessonFixture({
        chapterId: mainChapter.id,
        isPublished: true,
        organizationId,
        position: 0,
        slug: "main-lesson",
      }),
    ]);

    await expect(getFirstCourseLesson({ courseId: course.id })).resolves.toStrictEqual({
      chapterSlug: "intro",
      lessonSlug: "first-intro-lesson",
    });
  });

  it("returns null when the intro lesson does not exist", async () => {
    const course = await courseFixture({ organizationId });

    await expect(getFirstCourseLesson({ courseId: course.id })).resolves.toBeNull();
  });

  it("returns null for missing and malformed course ids", async () => {
    await expect(getFirstCourseLesson({ courseId: randomUUID() })).resolves.toBeNull();
    await expect(getFirstCourseLesson({ courseId: "invalid-id" })).resolves.toBeNull();
  });
});
