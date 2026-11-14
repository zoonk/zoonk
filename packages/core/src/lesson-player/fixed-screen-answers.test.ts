import { gradeTypedAnswer } from "@zoonk/ai/tasks/grading/grade-typed-answer";
import { type Step, prisma } from "@zoonk/db";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { appliedFixFixture } from "../staff/content-fixes/_test-utils/applied-fix";
import { type Json, toJson } from "../staff/content-fixes/_utils/resolved-change";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { typedGrade } from "./_test-utils/typed-grade";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { type LessonStepAnswer } from "./contract";
import { getPlayableLibraryLesson } from "./get-playable-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";

const TIME_ZONE = "UTC";
const MINUTE_MS = 60_000;

const check = playableStepContent.check;

/** The cloud question with its key moved: "the exact path" is now the option marked right. */
const movedKey = {
  ...check,
  options: check.options.map((option) => ({ ...option, isCorrect: option.id === "path" })),
};

const matchColumns = {
  pairs: [
    { left: "perro", right: "dog" },
    { left: "gato", right: "cat" },
  ],
};

const EXCUSED = {
  result: {
    checked: false,
    correctAnswer: null,
    feedback: null,
    isCorrect: false,
    savedMistake: false,
  },
  status: "checked",
};

async function fixScreen({
  content,
  decidedAt,
  step,
}: {
  content: Record<string, Json>;
  decidedAt?: Date;
  step: Pick<Step, "content" | "id" | "lessonId">;
}) {
  await prisma.step.update({ data: { content }, where: { id: step.id } });

  await appliedFixFixture({
    changes: [
      {
        fields: [{ after: content, before: toJson(step.content), field: "content" }],
        id: step.id,
        model: "Step",
        op: "set",
      },
    ],
    decidedAt,
    unitId: step.lessonId,
  });
}

function answer({
  runId,
  stepId,
  value,
}: {
  runId: string;
  stepId: string;
  value: LessonStepAnswer;
}) {
  return checkLessonStep({
    input: { answer: value, durationMs: 5000, runId, timeZone: TIME_ZONE },
    stepId,
  });
}

async function startRun(lessonId: string) {
  const outcome = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId });

  if (outcome.status !== "started") {
    throw new Error(`Expected a started run, got ${outcome.status}`);
  }

  return outcome.run;
}

async function savedAnswers({ stepId, userId }: { stepId: string; userId: string }) {
  const [attempts, mistakes] = await Promise.all([
    prisma.attempt.count({ where: { stepId, userId } }),
    prisma.mistake.count({ where: { stepId, userId } }),
  ]);

  return { attempts, mistakes };
}

describe("answers to a screen fixed during the run", () => {
  it("excuses a choice the fix made wrong and records one right under the fix", async () => {
    const { lesson, steps, user } = await setupPlayableLesson({ steps: ["check"] });
    const step = stepOfKind(steps, "check");
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

    await fixScreen({ content: movedKey, step });

    await expect(
      answer({ runId: run.id, stepId: step.id, value: { kind: "check", optionId: "likely" } }),
    ).resolves.toMatchObject(EXCUSED);

    await expect(savedAnswers({ stepId: step.id, userId: user.id })).resolves.toStrictEqual({
      attempts: 0,
      mistakes: 0,
    });

    await expect(
      answer({ runId: run.id, stepId: step.id, value: { kind: "check", optionId: "path" } }),
    ).resolves.toMatchObject({ result: { checked: true, isCorrect: true }, status: "checked" });

    await expect(savedAnswers({ stepId: step.id, userId: user.id })).resolves.toMatchObject({
      attempts: 1,
    });
  });

  it.each([
    { excused: true, fixedBeforeStartMinutes: 3 },
    { excused: false, fixedBeforeStartMinutes: 10 },
  ])(
    "counts a fix applied $fixedBeforeStartMinutes minutes before the run started as seen: excused $excused",
    async ({ excused, fixedBeforeStartMinutes }) => {
      const { lesson, steps, user } = await setupPlayableLesson({ steps: ["check"] });
      const step = stepOfKind(steps, "check");
      const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

      await fixScreen({
        content: movedKey,
        decidedAt: new Date(run.startedAt.getTime() - fixedBeforeStartMinutes * MINUTE_MS),
        step,
      });

      const outcome = await answer({
        runId: run.id,
        stepId: step.id,
        value: { kind: "check", optionId: "likely" },
      });

      expect(outcome).toMatchObject(
        excused ? EXCUSED : { result: { checked: true, isCorrect: false }, status: "checked" },
      );

      await expect(savedAnswers({ stepId: step.id, userId: user.id })).resolves.toMatchObject({
        attempts: excused ? 0 : 1,
      });
    },
  );

  it.each<{
    fixed: Record<string, Json>;
    kind: Step["kind"];
    old: LessonStepAnswer;
    start: object;
  }>([
    {
      fixed: { ...playableStepContent.fillBlank, answers: ["cloud of chances"] },
      kind: "fillBlank" as const,
      old: { kind: "fillBlank", userAnswers: ["cloud"] } satisfies LessonStepAnswer,
      start: playableStepContent.fillBlank,
    },
    {
      fixed: {
        pairs: [
          { left: "perro", right: "the dog" },
          { left: "gato", right: "cat" },
        ],
      },
      kind: "matchColumns" as const,
      old: {
        kind: "matchColumns",
        mistakes: 0,
        userPairs: matchColumns.pairs,
      } satisfies LessonStepAnswer,
      start: matchColumns,
    },
    {
      fixed: {
        ...playableStepContent.spokenAnswer,
        targetText: "The electron is a cloud of chances",
      },
      kind: "spokenAnswer" as const,
      old: { kind: "spokenAnswer", text: "The electron is a cloud" } satisfies LessonStepAnswer,
      start: playableStepContent.spokenAnswer,
    },
  ])("excuses an old answer to a $kind screen", async ({ fixed, kind, old, start }) => {
    const { lesson, user } = await setupPlayableLesson({ steps: ["explanation"] });

    const step = await libraryStepFixture({
      content: start,
      kind,
      lessonId: lesson.id,
      position: 1,
    });

    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

    await fixScreen({ content: fixed, step });

    await expect(answer({ runId: run.id, stepId: step.id, value: old })).resolves.toMatchObject(
      EXCUSED,
    );

    await expect(savedAnswers({ stepId: step.id, userId: user.id })).resolves.toStrictEqual({
      attempts: 0,
      mistakes: 0,
    });
  });

  it("excuses a written answer the model grades wrong against the fixed screen", async () => {
    const { lesson, steps, user } = await setupPlayableLesson({ steps: ["typedAnswer"] });
    const step = stepOfKind(steps, "typedAnswer");
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

    await fixScreen({
      content: { ...playableStepContent.typedAnswer, question: "Why is the nucleus drawn small?" },
      step,
    });

    vi.mocked(gradeTypedAnswer).mockResolvedValueOnce(
      typedGrade({ feedback: "That's about the cloud.", isCorrect: false, score: 0 }),
    );

    await expect(
      answer({
        runId: run.id,
        stepId: step.id,
        value: { kind: "typedAnswer", text: "It shows where the electron is likely to be" },
      }),
    ).resolves.toMatchObject(EXCUSED);

    await expect(savedAnswers({ stepId: step.id, userId: user.id })).resolves.toStrictEqual({
      attempts: 0,
      mistakes: 0,
    });
  });

  it.each(["reading", "listening"] as const)(
    "excuses an arrangement of a sentence a fix changed, on a %s screen",
    async (kind) => {
      const [user, { lesson, sentence, steps }] = await Promise.all([
        userFixture(),
        languageLessonFixture(),
      ]);

      const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
      mockSession(user.id);

      await prisma.sentence.update({
        data: { sentence: "How much is the monthly rent?" },
        where: { id: sentence.id },
      });

      await appliedFixFixture({
        changes: [
          {
            fields: [
              {
                after: "How much is the monthly rent?",
                before: sentence.sentence,
                field: "sentence",
              },
            ],
            id: sentence.id,
            model: "Sentence",
            op: "set",
          },
        ],
        unitId: lesson.id,
      });

      const step = stepOfKind(steps, kind);

      await expect(
        answer({
          runId: run.id,
          stepId: step.id,
          value: { arrangedWords: ["How", "much", "is", "the", "rent?"], kind },
        }),
      ).resolves.toMatchObject(EXCUSED);

      await expect(savedAnswers({ stepId: step.id, userId: user.id })).resolves.toStrictEqual({
        attempts: 0,
        mistakes: 0,
      });
    },
  );

  it("excuses a pick on a translation screen whose lesson word a fix changed, but not after another word's fix", async () => {
    const [user, { lesson, steps, word }] = await Promise.all([
      userFixture(),
      languageLessonFixture(),
    ]);

    const step = stepOfKind(steps, "translation");
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
    mockSession(user.id);

    const other = await prisma.word.create({
      data: { organizationId: word.organizationId, targetLanguage: "en", word: "lease" },
    });

    await prisma.lessonWord.create({
      data: {
        lessonId: lesson.id,
        model: "test",
        position: 1,
        promptVersion: "test",
        runId: "test",
        translation: "contrato",
        wordId: other.id,
      },
    });

    const lessonWordFix = (wordId: string) =>
      appliedFixFixture({
        changes: [
          {
            fields: [{ after: "o aluguel", before: "aluguel", field: "translation" }],
            id: wordId,
            lessonId: lesson.id,
            model: "LessonWord",
            op: "set",
          },
        ],
        unit: "word",
        unitId: wordId,
      });

    const wrongPick = () =>
      answer({
        runId: run.id,
        stepId: step.id,
        value: { kind: "translation", selectedOptionId: crypto.randomUUID() },
      });

    await lessonWordFix(other.id);

    await expect(wrongPick()).resolves.toMatchObject({
      result: { checked: true, isCorrect: false },
      status: "checked",
    });

    await lessonWordFix(word.id);

    await expect(wrongPick()).resolves.toMatchObject(EXCUSED);
  });

  it("excuses an arrangement on a listening screen whose lesson sentence a fix changed", async () => {
    const [user, { lesson, sentence, steps }] = await Promise.all([
      userFixture(),
      languageLessonFixture(),
    ]);

    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
    mockSession(user.id);

    await appliedFixFixture({
      changes: [
        {
          fields: [
            {
              after: "Quanto custa o aluguel?",
              before: "Quanto é o aluguel?",
              field: "translation",
            },
          ],
          id: sentence.id,
          lessonId: lesson.id,
          model: "LessonSentence",
          op: "set",
        },
      ],
      unit: "sentence",
      unitId: sentence.id,
    });

    const step = stepOfKind(steps, "listening");

    await expect(
      answer({
        runId: run.id,
        stepId: step.id,
        value: { arrangedWords: ["How", "much", "the", "rent?"], kind: "listening" },
      }),
    ).resolves.toMatchObject(EXCUSED);
  });

  it("finishes a run whose fixed screen was excused, and shows that screen fresh on resume", async () => {
    const { lesson, steps, user } = await setupPlayableLesson({ steps: ["check", "fillBlank"] });
    const run = await startRun(lesson.id);
    const fixed = stepOfKind(steps, "check");
    const blank = stepOfKind(steps, "fillBlank");

    await fixScreen({ content: movedKey, step: fixed });

    await expect(
      answer({ runId: run.runId, stepId: fixed.id, value: { kind: "check", optionId: "likely" } }),
    ).resolves.toMatchObject(EXCUSED);

    const resumed = await startRun(lesson.id);
    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(resumed.runId).toBe(run.runId);
    expect(resumed.answers.map((saved) => saved.stepId)).not.toContain(fixed.id);

    expect(
      played?.status === "ready" && played.lesson.steps.find((step) => step.id === fixed.id),
    ).toMatchObject({ content: movedKey });

    await answer({
      runId: run.runId,
      stepId: blank.id,
      value: { kind: "fillBlank", userAnswers: playableStepContent.fillBlank.answers },
    });

    await expect(
      completeLibraryLesson({
        input: { runId: run.runId, timeZone: TIME_ZONE },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 0 },
      status: "completed",
    });

    await expect(savedAnswers({ stepId: fixed.id, userId: user.id })).resolves.toMatchObject({
      attempts: 0,
    });
  });
});
