import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { submitPlayerCompletion } from "./submit-player-completion";

type CompletableLessonVisibility = {
  chapterIsPublished?: boolean;
  courseIsPublished?: boolean;
  lessonIsPublished?: boolean;
  organizationKind?: string;
};

const inaccessibleLessonCases: { name: string; visibility: CompletableLessonVisibility }[] = [
  { name: "course", visibility: { courseIsPublished: false } },
  { name: "chapter", visibility: { chapterIsPublished: false } },
  { name: "lesson", visibility: { lessonIsPublished: false } },
  { name: "organization", visibility: { organizationKind: "school" } },
];

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
 * The shared completion command only needs a standard curriculum path:
 * org -> course -> chapter. Visibility stays configurable so tests can verify
 * that the command rejects non-public curriculum before writing progress.
 */
async function createChapterContext(params: CompletableLessonVisibility = {}) {
  const organization = await organizationFixture({ kind: params.organizationKind ?? "brand" });

  const course = await courseFixture({
    isPublished: params.courseIsPublished ?? true,
    organizationId: organization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: params.chapterIsPublished ?? true,
    organizationId: organization.id,
  });

  return { chapter, course, organization };
}

/**
 * These tests exercise the shared player completion flow, so a single
 * multiple-choice step is enough to verify validation, persistence, and
 * follow-up effect planning without dragging in unrelated player variants.
 */
async function createMultipleChoiceLesson(params: {
  chapterId: string;
  isPublished?: boolean;
  organizationId: string;
  position?: number;
}) {
  const lesson = await lessonFixture({
    chapterId: params.chapterId,
    isPublished: params.isPublished ?? true,
    kind: "quiz",
    organizationId: params.organizationId,
    position: params.position ?? 0,
  });

  const step = await stepFixture({
    content: {
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
      [stepId]: { kind: "multipleChoice", selectedOptionId: params.selectedOptionId ?? "a" },
    },
    lessonId: params.lessonId,
    localDate: todayLocalDate(),
    startedAt,
    stepTimings: {
      [stepId]: { answeredAt: startedAt + 5000, dayOfWeek: 1, durationSeconds: 5, hourOfDay: 12 },
    },
  };
}

/**
 * Inaccessible completions must leave every progress table untouched. Reading
 * the affected rows in one helper keeps the rejection test focused on the
 * authorization boundary instead of repeating persistence details.
 */
async function readCompletionWrites(params: {
  courseId: string;
  lessonId: string;
  stepId: string;
  userId: string;
}) {
  const [
    chapterCompletion,
    courseCompletion,
    courseUser,
    dailyProgress,
    lessonProgress,
    stepAttempts,
    userProgress,
  ] = await Promise.all([
    prisma.chapterCompletion.findMany({ where: { userId: params.userId } }),
    prisma.courseCompletion.findMany({
      where: { courseId: params.courseId, userId: params.userId },
    }),
    prisma.courseUser.findUnique({
      where: { courseUser: { courseId: params.courseId, userId: params.userId } },
    }),
    prisma.dailyProgress.findMany({ where: { userId: params.userId } }),
    prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: params.lessonId, userId: params.userId } },
    }),
    prisma.stepAttempt.findMany({ where: { stepId: params.stepId, userId: params.userId } }),
    prisma.userProgress.findUnique({ where: { userId: params.userId } }),
  ]);

  return {
    chapterCompletion,
    courseCompletion,
    courseUser,
    dailyProgress,
    lessonProgress,
    stepAttempts,
    userProgress,
  };
}

describe(submitPlayerCompletion, () => {
  it("returns null when the submitted lesson no longer exists", async () => {
    const result = await submitPlayerCompletion({
      input: buildCompletionInput({ lessonId: randomUUID(), stepId: randomUUID() }),
      userId: randomUUID(),
    });

    expect(result).toBeNull();
  });

  it.each(inaccessibleLessonCases)(
    "returns null without writing progress when the submitted $name is not publicly completable",
    async (testCase) => {
      const [user, context] = await Promise.all([
        userFixture(),
        createChapterContext(testCase.visibility),
      ]);

      const { lesson, step } = await createMultipleChoiceLesson({
        chapterId: context.chapter.id,
        isPublished: testCase.visibility.lessonIsPublished,
        organizationId: context.organization.id,
      });

      const result = await submitPlayerCompletion({
        input: buildCompletionInput({ lessonId: lesson.id, stepId: step.id }),
        userId: user.id,
      });

      const writes = await readCompletionWrites({
        courseId: context.course.id,
        lessonId: lesson.id,
        stepId: step.id,
        userId: user.id,
      });

      expect(result).toBeNull();
      expect(writes.chapterCompletion).toHaveLength(0);
      expect(writes.courseCompletion).toHaveLength(0);
      expect(writes.courseUser).toBeNull();
      expect(writes.dailyProgress).toHaveLength(0);
      expect(writes.lessonProgress).toBeNull();
      expect(writes.stepAttempts).toHaveLength(0);
      expect(writes.userProgress).toBeNull();
    },
  );

  it("persists completion and requests preloading when the next lesson needs generation", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const [currentLesson, nextLesson] = await Promise.all([
      createMultipleChoiceLesson({
        chapterId: chapter.id,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const result = await submitPlayerCompletion({
      input: buildCompletionInput({
        lessonId: currentLesson.lesson.id,
        stepId: currentLesson.step.id,
      }),
      userId: user.id,
    });

    const [lessonProgress, stepAttempts] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: currentLesson.lesson.id, userId: user.id } },
      }),
      prisma.stepAttempt.findMany({ where: { stepId: currentLesson.step.id, userId: user.id } }),
    ]);

    expect(nextLesson.position).toBeGreaterThan(currentLesson.lesson.position);
    expect(result).toStrictEqual({ preloadLessonId: nextLesson.id });
    expect(lessonProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(1);
    expect(stepAttempts[0]?.isCorrect).toBe(true);
  });
});
