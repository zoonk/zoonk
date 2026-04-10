import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { cleanupDraftLessonStep } from "./cleanup-draft-lesson-step";

describe(cleanupDraftLessonStep, () => {
  let chapterId: number;
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Cleanup Draft Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  test("is idempotent when the draft lesson is already gone", async () => {
    const draftLesson = await lessonFixture({
      chapterId,
      generationStatus: "pending",
      isPublished: false,
      managementMode: "ai",
      organizationId,
      title: `Cleanup Draft Lesson ${randomUUID()}`,
    });

    await cleanupDraftLessonStep({ draftLessonId: draftLesson.id });
    await expect(
      cleanupDraftLessonStep({ draftLessonId: draftLesson.id }),
    ).resolves.toBeUndefined();

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: draftLesson.id },
    });

    expect(deletedLesson).toBeNull();
  });
});
