import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { submitPlayerCompletion } from "./submit-player-completion";

const TEST_SECONDS_PER_MINUTE = 60;
const TEST_COMPLETION_CAP_MINUTES = 30;
const TEST_COMPLETION_CAP_SECONDS = TEST_COMPLETION_CAP_MINUTES * TEST_SECONDS_PER_MINUTE;

const LANGUAGE_SENTENCE_STEP_LIMIT = 6;
const REVIEW_TARGET_STEP_COUNT = 10;
const REVIEW_SUBMITTED_STEP_COUNT = REVIEW_TARGET_STEP_COUNT + 1;

type CompletableLessonVisibility = {
  chapterIsPublished?: boolean;
  courseIsPublished?: boolean;
  lessonIsPublished?: boolean;
  organizationKind?: string;
};

type LanguageSentenceCompletionStep = { answerText: string; id: string };
type LanguageSentenceLessonKind = "listening" | "reading";

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
 * persistence without dragging in unrelated player variants.
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
    content: buildMultipleChoiceContent(),
    isPublished: true,
    kind: "multipleChoice",
    lessonId: lesson.id,
  });

  return { lesson, step };
}

/**
 * Multi-question completion coverage must be enforced by the server, so this
 * helper creates two trusted answerable steps without relying on player UI state.
 */
async function createTwoStepMultipleChoiceLesson(params: {
  chapterId: string;
  organizationId: string;
}) {
  const lesson = await lessonFixture({
    chapterId: params.chapterId,
    isPublished: true,
    kind: "quiz",
    organizationId: params.organizationId,
    position: 0,
  });

  const steps = await Promise.all(
    [0, 1].map((position) =>
      stepFixture({
        content: buildMultipleChoiceContent(),
        isPublished: true,
        kind: "multipleChoice",
        lessonId: lesson.id,
        position,
      }),
    ),
  );

  return { lesson, steps };
}

/**
 * Reading and listening lessons can store a larger generated sentence bank than
 * the player shows in one run. This fixture creates independently valid
 * sentence-backed steps so completion tests can prove the server accepts the
 * six-step player subset without accepting too few answers.
 */
async function createLanguageSentenceLesson(params: {
  chapterId: string;
  kind: LanguageSentenceLessonKind;
  organizationId: string;
  stepCount: number;
}) {
  const lesson = await lessonFixture({
    chapterId: params.chapterId,
    isPublished: true,
    kind: params.kind,
    organizationId: params.organizationId,
    position: 0,
  });

  const steps = await Promise.all(
    Array.from({ length: params.stepCount }, (_, position) =>
      createLanguageSentenceStep({
        chapterId: params.chapterId,
        kind: params.kind,
        lessonId: lesson.id,
        organizationId: params.organizationId,
        position,
      }),
    ),
  );

  return { lesson, steps };
}

/**
 * Server validation checks reading against the target-language sentence and
 * listening against the learner-language translation. Returning the exact
 * answer text with the step id lets forged completion payloads answer each
 * step correctly without depending on player UI code.
 */
async function createLanguageSentenceStep(params: {
  chapterId: string;
  kind: LanguageSentenceLessonKind;
  lessonId: string;
  organizationId: string;
  position: number;
}): Promise<LanguageSentenceCompletionStep> {
  const sentenceText = `word${params.position}`;
  const translationText = `translation${params.position}`;

  const sentence = await sentenceFixture({
    organizationId: params.organizationId,
    sentence: sentenceText,
  });

  const chapterSentence = await chapterSentenceFixture({
    chapterId: params.chapterId,
    sentenceId: sentence.id,
    sourceLessonId: params.lessonId,
    translation: translationText,
  });

  const step = await stepFixture({
    chapterSentenceId: chapterSentence.id,
    content: {},
    isPublished: true,
    kind: params.kind,
    lessonId: params.lessonId,
    position: params.position,
    sentenceId: sentence.id,
  });

  return {
    answerText: getLanguageSentenceAnswerText({ kind: params.kind, sentenceText, translationText }),
    id: step.id,
  };
}

/**
 * Reading asks the learner to reconstruct the target sentence, while listening
 * asks them to reconstruct its learner-language translation from audio. Keeping
 * this distinction explicit prevents listening tests from accidentally reusing
 * reading's answer text.
 */
function getLanguageSentenceAnswerText({
  kind,
  sentenceText,
  translationText,
}: {
  kind: LanguageSentenceLessonKind;
  sentenceText: string;
  translationText: string;
}): string {
  if (kind === "reading") {
    return sentenceText;
  }

  return translationText;
}

/**
 * Static lessons intentionally submit no answers. Keeping this fixture separate
 * prevents the completion-coverage tests from accidentally treating static
 * reading content as an answerable quiz.
 */
async function createStaticLesson(params: { chapterId: string; organizationId: string }) {
  const lesson = await lessonFixture({
    chapterId: params.chapterId,
    isPublished: true,
    kind: "explanation",
    organizationId: params.organizationId,
  });

  const step = await stepFixture({
    content: { text: "Read this first", title: "Intro", variant: "text" },
    isPublished: true,
    kind: "static",
    lessonId: lesson.id,
  });

  return { lesson, step };
}

/**
 * Review abuse tests need many equivalent interactive steps. Sharing this
 * content shape keeps the setup focused on the number of submitted step IDs,
 * not on differences between step contracts.
 */
function buildMultipleChoiceContent() {
  return {
    options: [
      { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
      { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
    ],
    question: "Choose",
  };
}

/**
 * Review completion payloads can be forged directly against the server action.
 * This helper builds that raw payload so the regression test verifies the
 * server-side validation boundary rather than the normal React player flow.
 */
function buildReviewCompletionInput(params: {
  lessonId: string;
  startedAt?: number;
  stepIds: string[];
}): CompletionInput {
  const startedAt = params.startedAt ?? Date.now() - 10_000;

  return {
    answers: Object.fromEntries(params.stepIds.map(buildMultipleChoiceAnswerEntry)),
    lessonId: params.lessonId,
    localDate: todayLocalDate(),
    startedAt,
    stepTimings: Object.fromEntries(
      params.stepIds.map((stepId) => buildStepTimingEntry({ startedAt, stepId })),
    ),
  };
}

/**
 * Each forged review answer uses the known correct option for the fixture step
 * so the test isolates the submitted-step cap instead of answer correctness.
 */
function buildMultipleChoiceAnswerEntry(
  stepId: string,
): [string, CompletionInput["answers"][string]] {
  return [stepId, { kind: "multipleChoice", selectedOptionId: "a" }];
}

/**
 * Step timings are required by the completion input schema. The exact values do
 * not matter for this bug, but every submitted step needs a realistic timing row.
 */
function buildStepTimingEntry(params: {
  startedAt: number;
  stepId: string;
}): [string, CompletionInput["stepTimings"][string]] {
  return [
    params.stepId,
    { answeredAt: params.startedAt + 5000, dayOfWeek: 1, durationSeconds: 5, hourOfDay: 12 },
  ];
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
 * Forged completion payloads are the easiest way to prove the server does not
 * trust the browser's idea of which answerable steps were completed.
 */
function buildCompletionInputForSteps(params: {
  lessonId: string;
  selectedOptionId?: string;
  startedAt?: number;
  stepIds: string[];
}): CompletionInput {
  const startedAt = params.startedAt ?? Date.now() - 10_000;

  return {
    answers: Object.fromEntries(
      params.stepIds.map((stepId) => [
        stepId,
        { kind: "multipleChoice", selectedOptionId: params.selectedOptionId ?? "a" },
      ]),
    ),
    lessonId: params.lessonId,
    localDate: todayLocalDate(),
    startedAt,
    stepTimings: Object.fromEntries(
      params.stepIds.map((stepId) => buildStepTimingEntry({ startedAt, stepId })),
    ),
  };
}

/**
 * Reading and listening completion payloads use arranged words rather than
 * option ids, so this keeps the sentence-cap tests focused on answer coverage
 * instead of multiple-choice fixture assumptions.
 */
function buildLanguageSentenceCompletionInput(params: {
  kind: LanguageSentenceLessonKind;
  lessonId: string;
  startedAt?: number;
  steps: LanguageSentenceCompletionStep[];
}): CompletionInput {
  const startedAt = params.startedAt ?? Date.now() - 10_000;

  return {
    answers: Object.fromEntries(
      params.steps.map((step) => buildLanguageSentenceAnswerEntry({ kind: params.kind, step })),
    ),
    lessonId: params.lessonId,
    localDate: todayLocalDate(),
    startedAt,
    stepTimings: Object.fromEntries(
      params.steps.map((step) => buildStepTimingEntry({ startedAt, stepId: step.id })),
    ),
  };
}

/**
 * The fixture answer text is a single token, so the correct sentence-bank
 * answer is the one-word arrangement containing that exact text.
 */
function buildLanguageSentenceAnswerEntry({
  kind,
  step,
}: {
  kind: LanguageSentenceLessonKind;
  step: LanguageSentenceCompletionStep;
}): [string, CompletionInput["answers"][string]] {
  return [step.id, buildLanguageSentenceAnswer({ kind, step })];
}

/**
 * Returning concrete discriminated-union members keeps the completion input
 * typed exactly like the player submission instead of relying on a widened
 * `reading | listening` kind.
 */
function buildLanguageSentenceAnswer({
  kind,
  step,
}: {
  kind: LanguageSentenceLessonKind;
  step: LanguageSentenceCompletionStep;
}): CompletionInput["answers"][string] {
  if (kind === "reading") {
    return { arrangedWords: [step.answerText], kind: "reading" };
  }

  return { arrangedWords: [step.answerText], kind: "listening" };
}

/**
 * Empty completions should only be accepted for trusted static lessons. The
 * schema allows this shape, so command-level tests need a direct way to submit it.
 */
function buildEmptyCompletionInput(params: { lessonId: string }): CompletionInput {
  return {
    answers: {},
    lessonId: params.lessonId,
    localDate: todayLocalDate(),
    startedAt: Date.now() - 10_000,
    stepTimings: {},
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
  it("ignores submissions for lessons that no longer exist", async () => {
    await expect(
      submitPlayerCompletion({
        input: buildCompletionInput({ lessonId: randomUUID(), stepId: randomUUID() }),
        userId: randomUUID(),
      }),
    ).resolves.toBeUndefined();
  });

  it.each(inaccessibleLessonCases)(
    "does not write progress when the submitted $name is not publicly completable",
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

      await submitPlayerCompletion({
        input: buildCompletionInput({ lessonId: lesson.id, stepId: step.id }),
        userId: user.id,
      });

      const writes = await readCompletionWrites({
        courseId: context.course.id,
        lessonId: lesson.id,
        stepId: step.id,
        userId: user.id,
      });

      expect(writes.chapterCompletion).toHaveLength(0);
      expect(writes.courseCompletion).toHaveLength(0);
      expect(writes.courseUser).toBeNull();
      expect(writes.dailyProgress).toHaveLength(0);
      expect(writes.lessonProgress).toBeNull();
      expect(writes.stepAttempts).toHaveLength(0);
      expect(writes.userProgress).toBeNull();
    },
  );

  it("persists completion for a valid interactive lesson", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const currentLesson = await createMultipleChoiceLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
      position: 0,
    });

    await submitPlayerCompletion({
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

    expect(lessonProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(1);
    expect(stepAttempts[0]?.isCorrect).toBe(true);
  });

  it("caps lesson duration so idle tabs do not inflate learning time", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson } = await createStaticLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    await submitPlayerCompletion({
      input: {
        ...buildEmptyCompletionInput({ lessonId: lesson.id }),
        startedAt: Date.now() - (TEST_COMPLETION_CAP_SECONDS + TEST_SECONDS_PER_MINUTE) * 1000,
      },
      userId: user.id,
    });

    const [dailyProgress, lessonProgress] = await Promise.all([
      prisma.dailyProgress.findFirst({ where: { userId: user.id } }),
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId: user.id } },
      }),
    ]);

    expect(dailyProgress?.timeSpentSeconds).toBe(TEST_COMPLETION_CAP_SECONDS);
    expect(lessonProgress?.durationSeconds).toBe(TEST_COMPLETION_CAP_SECONDS);
  });

  it("caps submitted step timings before creating attempt rows", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, step } = await createMultipleChoiceLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    const input = buildCompletionInput({ lessonId: lesson.id, stepId: step.id });

    await submitPlayerCompletion({
      input: {
        ...input,
        stepTimings: {
          [step.id]: {
            ...input.stepTimings[step.id]!,
            durationSeconds: TEST_COMPLETION_CAP_SECONDS + TEST_SECONDS_PER_MINUTE,
          },
        },
      },
      userId: user.id,
    });

    const attempt = await prisma.stepAttempt.findFirst({
      where: { stepId: step.id, userId: user.id },
    });

    expect(attempt?.durationSeconds).toBe(TEST_COMPLETION_CAP_SECONDS);
  });

  it("rejects empty answers for an interactive lesson without writing progress", async () => {
    const [user, { chapter, course, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, step } = await createMultipleChoiceLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    await submitPlayerCompletion({
      input: buildEmptyCompletionInput({ lessonId: lesson.id }),
      userId: user.id,
    });

    const writes = await readCompletionWrites({
      courseId: course.id,
      lessonId: lesson.id,
      stepId: step.id,
      userId: user.id,
    });

    expect(writes.dailyProgress).toHaveLength(0);
    expect(writes.lessonProgress).toBeNull();
    expect(writes.stepAttempts).toHaveLength(0);
    expect(writes.userProgress).toBeNull();
  });

  it("rejects partial answers for an interactive lesson without writing progress", async () => {
    const [user, { chapter, course, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, steps } = await createTwoStepMultipleChoiceLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    await submitPlayerCompletion({
      input: buildCompletionInputForSteps({ lessonId: lesson.id, stepIds: [steps[0]!.id] }),
      userId: user.id,
    });

    const writes = await readCompletionWrites({
      courseId: course.id,
      lessonId: lesson.id,
      stepId: steps[0]!.id,
      userId: user.id,
    });

    expect(writes.dailyProgress).toHaveLength(0);
    expect(writes.lessonProgress).toBeNull();
    expect(writes.stepAttempts).toHaveLength(0);
    expect(writes.userProgress).toBeNull();
  });

  it("persists reading completion when the six visible sentence answers are submitted", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, steps } = await createLanguageSentenceLesson({
      chapterId: chapter.id,
      kind: "reading",
      organizationId: organization.id,
      stepCount: LANGUAGE_SENTENCE_STEP_LIMIT + 2,
    });

    const visibleSteps = steps.slice(0, LANGUAGE_SENTENCE_STEP_LIMIT);

    await submitPlayerCompletion({
      input: buildLanguageSentenceCompletionInput({
        kind: "reading",
        lessonId: lesson.id,
        steps: visibleSteps,
      }),
      userId: user.id,
    });

    const [lessonProgress, stepAttempts] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId: user.id } },
      }),
      prisma.stepAttempt.findMany({
        where: { stepId: { in: steps.map((step) => step.id) }, userId: user.id },
      }),
    ]);

    expect(lessonProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(LANGUAGE_SENTENCE_STEP_LIMIT);

    expect(new Set(stepAttempts.map((attempt) => attempt.stepId))).toStrictEqual(
      new Set(visibleSteps.map((step) => step.id)),
    );
  });

  it("persists listening completion when the six visible translated sentence answers are submitted", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, steps } = await createLanguageSentenceLesson({
      chapterId: chapter.id,
      kind: "listening",
      organizationId: organization.id,
      stepCount: LANGUAGE_SENTENCE_STEP_LIMIT + 2,
    });

    const visibleSteps = steps.slice(0, LANGUAGE_SENTENCE_STEP_LIMIT);

    await submitPlayerCompletion({
      input: buildLanguageSentenceCompletionInput({
        kind: "listening",
        lessonId: lesson.id,
        steps: visibleSteps,
      }),
      userId: user.id,
    });

    const [lessonProgress, stepAttempts] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId: user.id } },
      }),
      prisma.stepAttempt.findMany({
        where: { stepId: { in: steps.map((step) => step.id) }, userId: user.id },
      }),
    ]);

    expect(lessonProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(LANGUAGE_SENTENCE_STEP_LIMIT);

    expect(new Set(stepAttempts.map((attempt) => attempt.stepId))).toStrictEqual(
      new Set(visibleSteps.map((step) => step.id)),
    );
  });

  it("rejects reading completion when fewer than six visible sentence answers are submitted", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, steps } = await createLanguageSentenceLesson({
      chapterId: chapter.id,
      kind: "reading",
      organizationId: organization.id,
      stepCount: LANGUAGE_SENTENCE_STEP_LIMIT + 2,
    });

    const partialSteps = steps.slice(0, LANGUAGE_SENTENCE_STEP_LIMIT - 1);

    await submitPlayerCompletion({
      input: buildLanguageSentenceCompletionInput({
        kind: "reading",
        lessonId: lesson.id,
        steps: partialSteps,
      }),
      userId: user.id,
    });

    const [lessonProgress, stepAttempts] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId: user.id } },
      }),
      prisma.stepAttempt.findMany({
        where: { stepId: { in: steps.map((step) => step.id) }, userId: user.id },
      }),
    ]);

    expect(lessonProgress).toBeNull();
    expect(stepAttempts).toHaveLength(0);
  });

  it("persists completion when every interactive answer is present but incorrect", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, steps } = await createTwoStepMultipleChoiceLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    await submitPlayerCompletion({
      input: buildCompletionInputForSteps({
        lessonId: lesson.id,
        selectedOptionId: "b",
        stepIds: steps.map((step) => step.id),
      }),
      userId: user.id,
    });

    const stepAttempts = await prisma.stepAttempt.findMany({
      where: { stepId: { in: steps.map((step) => step.id) }, userId: user.id },
    });

    expect(stepAttempts).toHaveLength(2);
    expect(stepAttempts.every((attempt) => !attempt.isCorrect)).toBe(true);
  });

  it("persists static-only lessons with empty answers", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const { lesson, step } = await createStaticLesson({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    await submitPlayerCompletion({
      input: buildEmptyCompletionInput({ lessonId: lesson.id }),
      userId: user.id,
    });

    const [dailyProgress, lessonProgress, stepAttempts] = await Promise.all([
      prisma.dailyProgress.findFirst({ where: { userId: user.id } }),
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId: user.id } },
      }),
      prisma.stepAttempt.findMany({ where: { stepId: step.id, userId: user.id } }),
    ]);

    expect(dailyProgress?.staticCompleted).toBe(1);
    expect(lessonProgress?.completedAt).toBeInstanceOf(Date);
    expect(stepAttempts).toHaveLength(0);
  });

  it("caps review completion validation at the review target count", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const [reviewLesson, sourceLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "review",
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const reviewableSteps = await Promise.all(
      Array.from({ length: REVIEW_SUBMITTED_STEP_COUNT }, (_, position) =>
        stepFixture({
          content: buildMultipleChoiceContent(),
          isPublished: true,
          kind: "multipleChoice",
          lessonId: sourceLesson.id,
          position,
        }),
      ),
    );

    await submitPlayerCompletion({
      input: buildReviewCompletionInput({
        lessonId: reviewLesson.id,
        stepIds: reviewableSteps.map((step) => step.id),
      }),
      userId: user.id,
    });

    const [dailyProgress, stepAttempts] = await Promise.all([
      prisma.dailyProgress.findFirst({ where: { userId: user.id } }),
      prisma.stepAttempt.findMany({
        where: { stepId: { in: reviewableSteps.map((step) => step.id) }, userId: user.id },
      }),
    ]);

    expect(stepAttempts).toHaveLength(REVIEW_TARGET_STEP_COUNT);
    expect(dailyProgress?.correctAnswers).toBe(REVIEW_TARGET_STEP_COUNT);
  });

  it("rejects review completion when fewer than the on-demand target steps are submitted", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const [reviewLesson, sourceLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "review",
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const reviewableSteps = await Promise.all(
      Array.from({ length: REVIEW_TARGET_STEP_COUNT }, (_, position) =>
        stepFixture({
          content: buildMultipleChoiceContent(),
          isPublished: true,
          kind: "multipleChoice",
          lessonId: sourceLesson.id,
          position,
        }),
      ),
    );

    await submitPlayerCompletion({
      input: buildReviewCompletionInput({
        lessonId: reviewLesson.id,
        stepIds: reviewableSteps.slice(0, 1).map((step) => step.id),
      }),
      userId: user.id,
    });

    const [dailyProgress, lessonProgress, stepAttempts] = await Promise.all([
      prisma.dailyProgress.findFirst({ where: { userId: user.id } }),
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: reviewLesson.id, userId: user.id } },
      }),
      prisma.stepAttempt.findMany({
        where: { stepId: { in: reviewableSteps.map((step) => step.id) }, userId: user.id },
      }),
    ]);

    expect(dailyProgress).toBeNull();
    expect(lessonProgress).toBeNull();
    expect(stepAttempts).toHaveLength(0);
  });

  it("persists review completion when only non-answerable fillers are missing", async () => {
    const [user, { chapter, organization }] = await Promise.all([
      userFixture(),
      createChapterContext(),
    ]);

    const [reviewLesson, sourceLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "review",
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "vocabulary",
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const answerableSteps = await Promise.all(
      Array.from({ length: REVIEW_TARGET_STEP_COUNT - 1 }, (_, position) =>
        stepFixture({
          content: buildMultipleChoiceContent(),
          isPublished: true,
          kind: "multipleChoice",
          lessonId: sourceLesson.id,
          position,
        }),
      ),
    );

    await stepFixture({
      content: {},
      isPublished: true,
      kind: "vocabulary",
      lessonId: sourceLesson.id,
      position: REVIEW_TARGET_STEP_COUNT,
    });

    await submitPlayerCompletion({
      input: buildReviewCompletionInput({
        lessonId: reviewLesson.id,
        stepIds: answerableSteps.map((step) => step.id),
      }),
      userId: user.id,
    });

    const [dailyProgress, stepAttempts] = await Promise.all([
      prisma.dailyProgress.findFirst({ where: { userId: user.id } }),
      prisma.stepAttempt.findMany({
        where: { stepId: { in: answerableSteps.map((step) => step.id) }, userId: user.id },
      }),
    ]);

    expect(stepAttempts).toHaveLength(REVIEW_TARGET_STEP_COUNT - 1);
    expect(dailyProgress?.correctAnswers).toBe(REVIEW_TARGET_STEP_COUNT - 1);
  });
});
