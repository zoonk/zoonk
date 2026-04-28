import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { submitPlayerCompletion } from "./submit-player-completion";

/**
 * Completion writes store a local calendar day alongside UTC timestamps so the
 * daily progress tables can aggregate by the learner's own timezone. Tests only
 * need a valid local date string, so this helper keeps that formatting in one place.
 */
function todayLocalDate(): string {
  const now = new Date();

  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/**
 * The shared completion command only needs a standard published curriculum path:
 * org -> course -> chapter. Keeping this setup centralized makes each test focus
 * on the lesson/lesson state it wants to verify.
 */
async function createPublishedChapterContext() {
  const organization = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
  });
  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
  });

  return { chapter, organization };
}

/**
 * These tests exercise the shared player completion flow, so a single
 * multiple-choice step is enough to verify validation, persistence, and
 * follow-up effect planning without dragging in unrelated player variants.
 */
async function createMultipleChoiceLesson(params: {
  lessonId: string;
  organizationId: string;
  position?: number;
}) {
  const lesson = await lessonFixture({
    isPublished: true,
    kind: "quiz",
    lessonId: params.lessonId,
    organizationId: params.organizationId,
    position: params.position ?? 0,
  });
  const step = await stepFixture({
    content: {
      kind: "core",
      options: [
        { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
        { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
      ],
      question: "Choose",
    },
    isPublished: true,
    kind: "multipleChoice",
    lessonId: lesson.id,
  });

  return { lesson, step };
}

/**
 * The command accepts the same payload produced by the player reducer. This
 * helper builds the smallest valid payload that still exercises the full server
 * validation path for a multiple-choice step.
 */
function buildCompletionInput(params: {
  lessonId: string;
  selectedOptionId?: string;
  startedAt?: number;
  stepId: string;
}): CompletionInput {
  const startedAt = params.startedAt ?? Date.now() - 10_000;
  const stepId = params.stepId;

  return {
    answers: {
      [stepId]: {
        kind: "multipleChoice",
        selectedOptionId: params.selectedOptionId ?? "a",
      },
    },
    lessonId: params.lessonId,
    localDate: todayLocalDate(),
    startedAt,
    stepTimings: {
      [stepId]: {
        answeredAt: startedAt + 5000,
        dayOfWeek: 1,
        durationSeconds: 5,
        hourOfDay: 12,
      },
    },
  };
}

describe(submitPlayerCompletion, () => {
  test("returns null when the submitted lesson no longer exists", async () => {
    const result = await submitPlayerCompletion({
      input: buildCompletionInput({
        lessonId: randomUUID(),
        stepId: randomUUID(),
      }),
      userId: "missing-user-id",
    });

    expect(result).toBeNull();
  });

  test("persists completion and requests preloading when the next lesson needs generation", async () => {
    const user = await userFixture();
    const { chapter, organization } = await createPublishedChapterContext();
    const currentLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });
    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });
    const { lesson, step } = await createMultipleChoiceLesson({
      lessonId: currentLesson.id,
      organizationId: organization.id,
    });

    const result = await submitPlayerCompletion({
      input: buildCompletionInput({
        lessonId: lesson.id,
        stepId: step.id,
      }),
      userId: user.id,
    });

    const [lessonProgress, stepAttempts] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: {
          userLesson: {
            lessonId: lesson.id,
            userId: user.id,
          },
        },
      }),
      prisma.stepAttempt.findMany({
        where: {
          stepId: step.id,
          userId: user.id,
        },
      }),
    ]);

    expect(nextLesson.position).toBeGreaterThan(currentLesson.position);
    expect(result).toEqual({
      preloadLessonId: nextLesson.id,
    });
    expect(lessonProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(1);
    expect(stepAttempts[0]?.isCorrect).toBe(true);
  });
});
