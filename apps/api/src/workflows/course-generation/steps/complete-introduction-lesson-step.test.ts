import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { INTRODUCTION_LESSON_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { completeIntroductionLessonStep } from "./complete-introduction-lesson-step";

describe(completeIntroductionLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("streams the intro first lesson route as the early completion target", async () => {
    const course = await courseFixture({ organizationId, slug: `course-${randomUUID()}` });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      position: 0,
      slug: `intro-${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      position: 0,
      slug: `first-${randomUUID()}`,
    });

    await completeIntroductionLessonStep({ lessonId: lesson.id });

    expect(getStreamedEvents()).toContainEqual(
      expect.objectContaining({
        entityId: `${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
        status: "completed",
        step: INTRODUCTION_LESSON_COMPLETION_STEP,
      }),
    );
  });

  it("rejects non-first intro lessons", async () => {
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 0 });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      position: 1,
      slug: `second-${randomUUID()}`,
    });

    await expect(completeIntroductionLessonStep({ lessonId: lesson.id })).rejects.toThrow(
      "Introduction lesson completion requires the first intro lesson",
    );
  });
});
