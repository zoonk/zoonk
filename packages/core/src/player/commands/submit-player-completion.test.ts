import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
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
 * on the lesson/activity state it wants to verify.
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
async function createMultipleChoiceActivity(params: {
  lessonId: number;
  organizationId: number;
  position?: number;
}) {
  const activity = await activityFixture({
    isPublished: true,
    kind: "quiz",
    lessonId: params.lessonId,
    organizationId: params.organizationId,
    position: params.position ?? 0,
  });
  const step = await stepFixture({
    activityId: activity.id,
    content: {
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "A" },
        { feedback: "Wrong.", isCorrect: false, text: "B" },
      ],
      question: "Choose",
    },
    isPublished: true,
    kind: "multipleChoice",
  });

  return { activity, step };
}

/**
 * The command accepts the same payload produced by the player reducer. This
 * helper builds the smallest valid payload that still exercises the full server
 * validation path for a multiple-choice step.
 */
function buildCompletionInput(params: {
  activityId: bigint | string;
  selectedIndex?: number;
  selectedText?: string;
  startedAt?: number;
  stepId: bigint | string;
}): CompletionInput {
  const startedAt = params.startedAt ?? Date.now() - 10_000;
  const stepId = String(params.stepId);

  return {
    activityId: String(params.activityId),
    answers: {
      [stepId]: {
        kind: "multipleChoice",
        selectedIndex: params.selectedIndex ?? 0,
        selectedText: params.selectedText ?? "A",
      },
    },
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
  test("returns null when the submitted activity no longer exists", async () => {
    const result = await submitPlayerCompletion({
      input: buildCompletionInput({
        activityId: "999999999",
        stepId: "999999999",
      }),
      userId: 1,
    });

    expect(result).toBeNull();
  });

  test("persists completion and requests preloading when the next lesson needs generation", async () => {
    const user = await userFixture();
    const { chapter, organization } = await createPublishedChapterContext();
    const currentLesson = await lessonFixture({
      chapterId: chapter.id,
      generationVersion: 1,
      isPublished: true,
      managementMode: "manual",
      organizationId: organization.id,
      position: 0,
    });
    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      generationVersion: null,
      isPublished: true,
      managementMode: "ai",
      organizationId: organization.id,
      position: 1,
    });
    const { activity, step } = await createMultipleChoiceActivity({
      lessonId: currentLesson.id,
      organizationId: organization.id,
    });

    const result = await submitPlayerCompletion({
      input: buildCompletionInput({
        activityId: activity.id,
        stepId: step.id,
      }),
      userId: user.id,
    });

    const [activityProgress, stepAttempts] = await Promise.all([
      prisma.activityProgress.findUnique({
        where: {
          userActivity: {
            activityId: activity.id,
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

    expect(nextLesson.id).toBeGreaterThan(currentLesson.id);
    expect(result).toEqual({
      preloadLessonId: nextLesson.id,
      regenerateLessonId: null,
    });
    expect(activityProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(1);
    expect(stepAttempts[0]?.isCorrect).toBe(true);
  });

  test("returns a regeneration effect when the completed lesson is AI-managed and outdated", async () => {
    const user = await userFixture();
    const { chapter, organization } = await createPublishedChapterContext();
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId: organization.id,
      position: 0,
    });
    const { activity, step } = await createMultipleChoiceActivity({
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    const result = await submitPlayerCompletion({
      input: buildCompletionInput({
        activityId: activity.id,
        stepId: step.id,
      }),
      userId: user.id,
    });

    expect(result).toEqual({
      preloadLessonId: null,
      regenerateLessonId: lesson.id,
    });
  });
});
