import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { beforeAll, describe, expect, it } from "vitest";
import { getFirstCourseLessonHref } from "./get-first-course-lesson-href";

describe(getFirstCourseLessonHref, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns the position-zero intro lesson route", async () => {
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

    await expect(
      getFirstCourseLessonHref({ courseId: course.id, courseSlug: course.slug }),
    ).resolves.toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/intro/l/first-intro-lesson`);
  });

  it("returns null when the intro lesson route does not exist", async () => {
    const course = await courseFixture({ organizationId });

    await expect(
      getFirstCourseLessonHref({ courseId: course.id, courseSlug: course.slug }),
    ).resolves.toBeNull();
  });
});
