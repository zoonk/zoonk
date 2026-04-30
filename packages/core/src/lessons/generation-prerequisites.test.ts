import { randomUUID } from "node:crypto";
import { type LessonKind } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { getBlockingLessonGenerationPrerequisite } from "./generation-prerequisites";

/**
 * Prerequisite checks only care about published lesson order inside one
 * chapter, so each test gets an isolated AI course tree with unique titles.
 */
async function createChapter({ organizationId }: { organizationId: string }) {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
    title: `Prerequisite Course ${randomUUID()}`,
  });

  return chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `Prerequisite Chapter ${randomUUID()}`,
  });
}

/**
 * Test rows need exact positions and generation statuses to exercise the same
 * source-range boundaries the lesson-generation workflow uses in production.
 */
async function createLesson({
  chapterId,
  generationStatus = "completed",
  kind,
  organizationId,
  position,
}: {
  chapterId: string;
  generationStatus?: "completed" | "failed" | "pending" | "running";
  kind: LessonKind;
  organizationId: string;
  position: number;
}) {
  return lessonFixture({
    chapterId,
    generationStatus,
    isPublished: true,
    kind,
    organizationId,
    position,
    title: `Prerequisite Lesson ${randomUUID()}`,
  });
}

describe(getBlockingLessonGenerationPrerequisite, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns the first incomplete explanation since the previous practice", async () => {
    const chapter = await createChapter({ organizationId });

    const lessons = await Promise.all([
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "explanation",
        organizationId,
        position: 0,
      }),
      createLesson({ chapterId: chapter.id, kind: "practice", organizationId, position: 1 }),
      createLesson({ chapterId: chapter.id, kind: "explanation", organizationId, position: 2 }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "running",
        kind: "explanation",
        organizationId,
        position: 3,
      }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "practice",
        organizationId,
        position: 4,
      }),
    ]);
    const runningExplanation = lessons[3];
    const practice = lessons[4];

    await expect(getBlockingLessonGenerationPrerequisite(practice)).resolves.toMatchObject({
      generationStatus: "running",
      lessonId: runningExplanation.id,
    });
  });

  it("returns null when every source explanation is completed", async () => {
    const chapter = await createChapter({ organizationId });

    const [, practice] = await Promise.all([
      createLesson({ chapterId: chapter.id, kind: "explanation", organizationId, position: 0 }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "practice",
        organizationId,
        position: 1,
      }),
    ]);

    await expect(getBlockingLessonGenerationPrerequisite(practice)).resolves.toBeNull();
  });

  it("uses the previous quiz as the quiz source boundary", async () => {
    const chapter = await createChapter({ organizationId });

    const lessons = await Promise.all([
      createLesson({
        chapterId: chapter.id,
        generationStatus: "failed",
        kind: "explanation",
        organizationId,
        position: 0,
      }),
      createLesson({ chapterId: chapter.id, kind: "quiz", organizationId, position: 1 }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "explanation",
        organizationId,
        position: 2,
      }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "quiz",
        organizationId,
        position: 3,
      }),
    ]);

    const pendingExplanation = lessons[2];
    const quiz = lessons[3];

    await expect(getBlockingLessonGenerationPrerequisite(quiz)).resolves.toMatchObject({
      generationStatus: "pending",
      lessonId: pendingExplanation.id,
    });
  });

  it("returns the nearest incomplete vocabulary source for translation", async () => {
    const chapter = await createChapter({ organizationId });

    const lessons = await Promise.all([
      createLesson({ chapterId: chapter.id, kind: "vocabulary", organizationId, position: 0 }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "vocabulary",
        organizationId,
        position: 1,
      }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "translation",
        organizationId,
        position: 2,
      }),
    ]);

    const pendingVocabulary = lessons[1];
    const translation = lessons[2];

    await expect(getBlockingLessonGenerationPrerequisite(translation)).resolves.toMatchObject({
      generationStatus: "pending",
      lessonId: pendingVocabulary.id,
    });
  });

  it("returns the first incomplete vocabulary since the previous reading", async () => {
    const chapter = await createChapter({ organizationId });

    const lessons = await Promise.all([
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "vocabulary",
        organizationId,
        position: 0,
      }),
      createLesson({ chapterId: chapter.id, kind: "reading", organizationId, position: 1 }),
      createLesson({ chapterId: chapter.id, kind: "vocabulary", organizationId, position: 2 }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "failed",
        kind: "vocabulary",
        organizationId,
        position: 3,
      }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "reading",
        organizationId,
        position: 4,
      }),
    ]);

    const failedVocabulary = lessons[3];
    const reading = lessons[4];

    await expect(getBlockingLessonGenerationPrerequisite(reading)).resolves.toMatchObject({
      generationStatus: "failed",
      lessonId: failedVocabulary.id,
    });
  });

  it("returns the nearest incomplete reading source for listening", async () => {
    const chapter = await createChapter({ organizationId });

    const lessons = await Promise.all([
      createLesson({ chapterId: chapter.id, kind: "reading", organizationId, position: 0 }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "running",
        kind: "reading",
        organizationId,
        position: 1,
      }),
      createLesson({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "listening",
        organizationId,
        position: 2,
      }),
    ]);

    const runningReading = lessons[1];
    const listening = lessons[2];

    await expect(getBlockingLessonGenerationPrerequisite(listening)).resolves.toMatchObject({
      generationStatus: "running",
      lessonId: runningReading.id,
    });
  });

  it("returns null for lesson kinds without generation prerequisites", async () => {
    const chapter = await createChapter({ organizationId });

    const explanation = await createLesson({
      chapterId: chapter.id,
      generationStatus: "pending",
      kind: "explanation",
      organizationId,
      position: 0,
    });

    await expect(getBlockingLessonGenerationPrerequisite(explanation)).resolves.toBeNull();
  });
});
