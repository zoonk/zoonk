import { randomUUID } from "node:crypto";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getUsageRule } from "../entitlements/limits";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { type LessonStepCheckOutcome, checkLessonStep } from "./check-lesson-step";
import { type LessonStepAnswer } from "./contract";
import type * as GradeTypedAnswer from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Grading and plain-words edits claim small AI help, which reads the request for its rate limit. */
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** Accepted answers are graded by code; only answers that need the model get a stand-in. */
vi.mock("@zoonk/ai/tasks/v2/grading/grade-typed-answer", async (importOriginal) => {
  const actual = await importOriginal<typeof GradeTypedAnswer>();
  return { ...actual, gradeTypedAnswer: vi.fn(actual.gradeTypedAnswer) };
});

async function setupRun(options?: Parameters<typeof setupPlayableLesson>[0]) {
  const setup = await setupPlayableLesson(options);
  const run = await lessonRunFixture({ lessonId: setup.lesson.id, userId: setup.user.id });
  return { ...setup, run };
}

function check({
  answer,
  runId,
  stepId,
  usedHelp,
}: {
  answer: LessonStepAnswer;
  runId: string;
  stepId: string;
  usedHelp?: boolean;
}) {
  return checkLessonStep({
    input: { answer, durationMs: 8000, runId, timeZone: "UTC", usedHelp },
    stepId,
  });
}

describe(checkLessonStep, () => {
  it("records a right answer against the lesson's skill and says when it comes back", async () => {
    const { run, skill, steps, user } = await setupRun();
    const step = stepOfKind(steps, "check");

    const outcome = await check({
      answer: { kind: "check", optionId: "likely" },
      runId: run.id,
      stepId: step.id,
    });

    expect(outcome).toMatchObject({
      result: { correctAnswer: null, isCorrect: true, keyPoints: null, savedMistake: false },
      status: "checked",
    });

    const [attempt, learnerSkill] = await Promise.all([
      prisma.attempt.findFirstOrThrow({ where: { stepId: step.id, userId: user.id } }),
      prisma.learnerSkill.findUniqueOrThrow({
        where: { userSkill: { skillId: skill.id, userId: user.id } },
      }),
    ]);

    expect(attempt).toMatchObject({
      answer: { kind: "check", optionId: "likely" },
      isCorrect: true,
      skillId: skill.id,
    });

    expect(outcome.status === "checked" && outcome.result.nextReviewAt).toBe(
      learnerSkill.due?.toISOString(),
    );
  });

  it("records answers of a run started from a session with that session", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const session = await studySessionFixture({ userId: user.id });
    await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });

    const run = await lessonRunFixture({
      lessonId: lesson.id,
      studySessionId: session.id,
      userId: user.id,
    });

    const step = stepOfKind(steps, "check");

    await check({ answer: { kind: "check", optionId: "likely" }, runId: run.id, stepId: step.id });

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { stepId: step.id, userId: user.id } }),
    ).resolves.toMatchObject({ studySessionId: session.id });
  });

  it("saves a wrong answer to the mistakes notebook with the question and the why", async () => {
    const { run, steps, user } = await setupRun();
    const step = stepOfKind(steps, "check");

    const outcome = await check({
      answer: { kind: "check", optionId: "size" },
      runId: run.id,
      stepId: step.id,
    });

    expect(outcome).toMatchObject({
      result: {
        correctAnswer: "Where the electron is most likely to be found",
        feedback: "The cloud is far bigger than the electron. It maps chances, not size.",
        isCorrect: false,
        savedMistake: true,
      },
      status: "checked",
    });

    const mistake = await prisma.mistake.findFirstOrThrow({ where: { userId: user.id } });

    expect(mistake).toMatchObject({
      snapshot: {
        answer: "The electron's size",
        correctAnswer: "Where the electron is most likely to be found",
        format: "check",
        question: 'What does the electron "cloud" show?',
      },
      status: "open",
      stepId: step.id,
    });
  });

  it("grades an accepted typed answer in code with every key point met", async () => {
    const { run, steps } = await setupRun();

    const outcome = await check({
      answer: { kind: "typedAnswer", text: "it shows where the electron is likely to be." },
      runId: run.id,
      stepId: stepOfKind(steps, "typedAnswer").id,
    });

    expect(outcome).toMatchObject({
      result: {
        corrections: [],
        feedback: null,
        isCorrect: true,
        keyPoints: [
          { met: true, text: "We can't know the electron's exact position or path" },
          { met: true, text: "The cloud shows where it's likely to be found" },
        ],
        score: 1,
      },
      status: "checked",
    });
  });

  it("shows the key points the grader found and a full answer when some are missing", async () => {
    const { run, steps } = await setupRun();

    vi.mocked(gradeTypedAnswer).mockResolvedValueOnce({
      data: {
        corrections: [],
        feedback: "You said it's likely somewhere, but not why we can't know where.",
        isCorrect: false,
        keyPoints: [
          { met: false, text: "We can't know the electron's exact position or path" },
          { met: true, text: "The cloud shows where it's likely to be found" },
        ],
        method: "model",
        score: 0.5,
        spelling: null,
      },
      provenance: null,
      systemPrompt: "",
      usage: null,
      userPrompt: "",
    });

    const outcome = await check({
      answer: { kind: "typedAnswer", text: "Because it's probably around there" },
      runId: run.id,
      stepId: stepOfKind(steps, "typedAnswer").id,
    });

    expect(outcome).toMatchObject({
      result: {
        correctAnswer:
          "Because we can't pin down where the electron is. The cloud maps where it's most likely to be.",
        feedback: "You said it's likely somewhere, but not why we can't know where.",
        isCorrect: false,
        score: 0.5,
      },
      status: "checked",
    });

    expect(gradeTypedAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en", practicedLanguage: null }),
    );
  });

  it("records nothing when the grader fails, so a grading failure is never a mistake", async () => {
    const { run, steps, user } = await setupRun();
    const step = stepOfKind(steps, "typedAnswer");

    vi.mocked(gradeTypedAnswer).mockRejectedValueOnce(
      new Error("AI provider didn't grade every key point of a typed answer"),
    );

    await expect(
      check({
        answer: { kind: "typedAnswer", text: "Because it's probably around there" },
        runId: run.id,
        stepId: step.id,
      }),
    ).rejects.toThrow("grade every key point");

    const [attempts, mistakes] = await Promise.all([
      prisma.attempt.count({ where: { stepId: step.id, userId: user.id } }),
      prisma.mistake.count({ where: { stepId: step.id, userId: user.id } }),
    ]);

    expect([attempts, mistakes]).toStrictEqual([0, 0]);
  });

  it("counts a typo as right, shows the spelling and saves no mistake", async () => {
    const { run, steps, user } = await setupRun();
    const step = stepOfKind(steps, "typedAnswer");

    const outcome = await check({
      answer: { kind: "typedAnswer", text: "It shows where the electorn is likely to be" },
      runId: run.id,
      stepId: step.id,
    });

    expect(outcome).toMatchObject({
      result: {
        isCorrect: true,
        savedMistake: false,
        spelling: "It shows where the electron is likely to be",
      },
      status: "checked",
    });

    await expect(
      prisma.mistake.count({ where: { stepId: step.id, userId: user.id } }),
    ).resolves.toBe(0);
  });

  it("shows a language form mistake as a correction, not a missing idea or a spelling", async () => {
    const { run, steps } = await setupRun();
    const corrections = [{ right: "the electron", wrong: "the electrons" }];

    vi.mocked(gradeTypedAnswer).mockResolvedValueOnce({
      data: {
        corrections,
        feedback: "Every idea is there; it's one electron, so “the electron”.",
        isCorrect: false,
        keyPoints: [
          { met: true, text: "We can't know the electron's exact position or path" },
          { met: true, text: "The cloud shows where it's likely to be found" },
        ],
        method: "model",
        score: 1,
        spelling: "It shows where the electron is likely to be",
      },
      provenance: null,
      systemPrompt: "",
      usage: null,
      userPrompt: "",
    });

    const outcome = await check({
      answer: { kind: "typedAnswer", text: "It shows where the electrons is likely to be" },
      runId: run.id,
      stepId: stepOfKind(steps, "typedAnswer").id,
    });

    expect(outcome).toMatchObject({
      result: { corrections, isCorrect: false, savedMistake: true, score: 1, spelling: null },
      status: "checked",
    });
  });

  it("grades the typed fallback of a spoken answer against the target text", async () => {
    const { run, steps } = await setupRun();

    const outcome = await check({
      answer: { kind: "spokenAnswer", text: "The electron is a cloud" },
      runId: run.id,
      stepId: stepOfKind(steps, "spokenAnswer").id,
    });

    expect(outcome).toMatchObject({ result: { isCorrect: true }, status: "checked" });
  });

  it("grades activities and language exercises with the player's code", async () => {
    const { run, steps } = await setupRun({ steps: ["activity", "multipleChoice"] });

    const [activity, exercise] = await Promise.all([
      check({
        answer: { answer: { kind: "numeric", value: 5 }, kind: "activity" },
        runId: run.id,
        stepId: stepOfKind(steps, "activity").id,
      }),
      check({
        answer: { kind: "multipleChoice", selectedOptionId: "orbit" },
        runId: run.id,
        stepId: stepOfKind(steps, "multipleChoice").id,
      }),
    ]);

    expect(activity).toMatchObject({ result: { isCorrect: true }, status: "checked" });

    expect(exercise).toMatchObject({
      result: { correctAnswer: "A cloud", isCorrect: false },
      status: "checked",
    });
  });

  it("grades language screens against the lesson's word and sentence", async () => {
    const [user, { lesson, steps, word }] = await Promise.all([
      userFixture(),
      languageLessonFixture(),
    ]);

    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
    mockSession(user.id);

    const [translation, reading] = await Promise.all([
      check({
        answer: { kind: "translation", selectedOptionId: word.id },
        runId: run.id,
        stepId: stepOfKind(steps, "translation").id,
      }),
      check({
        answer: { arrangedWords: ["How", "much", "is", "rent", "the?"], kind: "reading" },
        runId: run.id,
        stepId: stepOfKind(steps, "reading").id,
      }),
    ]);

    expect(translation).toMatchObject({ result: { isCorrect: true }, status: "checked" });

    expect(reading).toMatchObject({
      result: { correctAnswer: "How much is the rent?", isCorrect: false },
      status: "checked",
    });
  });

  it("grades a spoken screen played as listening, and saves a miss as a listening mistake", async () => {
    const [user, { lesson, steps }] = await Promise.all([userFixture(), languageLessonFixture()]);
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
    const stepId = stepOfKind(steps, "spokenAnswer").id;
    mockSession(user.id);

    const right = await check({
      answer: { arrangedWords: ["Quanto", "é", "o", "aluguel?"], kind: "listening" },
      runId: run.id,
      stepId,
    });

    const wrong = await check({
      answer: { arrangedWords: ["o", "Quanto", "é", "aluguel?"], kind: "listening" },
      runId: run.id,
      stepId,
    });

    expect(right).toMatchObject({ result: { isCorrect: true }, status: "checked" });

    expect(wrong).toMatchObject({
      result: { correctAnswer: "Quanto é o aluguel?", isCorrect: false, savedMistake: true },
      status: "checked",
    });

    await expect(
      prisma.mistake.findFirstOrThrow({ where: { stepId, userId: user.id } }),
    ).resolves.toMatchObject({ snapshot: { answer: "o Quanto é aluguel?", format: "listening" } });
  });

  it("refuses answers to reading screens and answers that don't fit the screen", async () => {
    const { run, steps, user } = await setupRun();

    const [hook, mismatch] = await Promise.all([
      check({
        answer: { kind: "check", optionId: "no" },
        runId: run.id,
        stepId: stepOfKind(steps, "hook").id,
      }),
      check({
        answer: { kind: "check", optionId: "missing" },
        runId: run.id,
        stepId: stepOfKind(steps, "check").id,
      }),
    ]);

    expect([hook, mismatch]).toStrictEqual([{ status: "invalid" }, { status: "invalid" }]);
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("only counts answers toward the learner's own open run of that lesson", async () => {
    const { lesson, run, steps, user } = await setupRun();
    const other = await setupRun();
    const stepId = stepOfKind(steps, "check").id;
    const answer = { kind: "check", optionId: "likely" } as const;

    mockSession(user.id);

    const [otherLessonRun, finishedRun] = await Promise.all([
      check({ answer, runId: other.run.id, stepId }),
      lessonRunFixture({ endedAt: new Date(), lessonId: lesson.id, userId: user.id }).then(
        (ended) => check({ answer, runId: ended.id, stepId }),
      ),
    ]);

    expect(otherLessonRun).toStrictEqual({ status: "notFound" });
    expect(finishedRun).toStrictEqual({ status: "runEnded" });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(check({ answer, runId: run.id, stepId })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("grades a screen answered over and over in one run without recording more of it", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "check").id;
    const answer = { kind: "check", optionId: "path" } as const;

    /** Each answer lands before the next one is counted. */
    const outcomes = await [1, 2, 3, 4].reduce<Promise<LessonStepCheckOutcome[]>>(
      async (previous) => {
        const earlier = await previous;
        const outcome = await check({ answer, runId: run.id, stepId });
        return [...earlier, outcome];
      },
      Promise.resolve([]),
    );

    expect(outcomes.map((outcome) => outcome.status)).toStrictEqual([
      "checked",
      "checked",
      "checked",
      "checked",
    ]);

    expect(outcomes.at(-1)).toMatchObject({ result: { isCorrect: false, savedMistake: false } });

    await expect(prisma.attempt.count({ where: { stepId, userId: user.id } })).resolves.toBe(3);
  });

  it.each([
    { guest: false, tier: "free" as const },
    { guest: true, tier: "guest" as const },
  ])(
    "grades a $tier learner's written answer with the model past their small AI help, without counting it",
    async ({ guest, tier }) => {
      const { run, steps, user } = await setupRun({ guest });
      const capped = getUsageRule({ kind: "assist", tier }).day ?? 0;

      await usageRecordsFixture({
        count: capped,
        createdAt: new Date(),
        kind: "assist",
        userId: user.id,
      });

      vi.mocked(gradeTypedAnswer).mockResolvedValueOnce({
        data: {
          corrections: [],
          feedback: "Both ideas are there.",
          isCorrect: true,
          keyPoints: [
            { met: true, text: "We can't know the electron's exact position or path" },
            { met: true, text: "The cloud shows where it's likely to be found" },
          ],
          method: "model",
          score: 1,
          spelling: null,
        },
        provenance: null,
        systemPrompt: "",
        usage: null,
        userPrompt: "",
      });

      const outcome = await check({
        answer: {
          kind: "typedAnswer",
          text: "We can't pin down its path, so the cloud maps where it's probably found",
        },
        runId: run.id,
        stepId: stepOfKind(steps, "typedAnswer").id,
      });

      expect(outcome).toMatchObject({
        result: { checked: true, isCorrect: true, savedMistake: false, score: 1 },
        status: "checked",
      });

      expect(gradeTypedAnswer).toHaveBeenCalledOnce();

      await expect(
        prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
      ).resolves.toBe(capped);
    },
  );

  it("past a few graded answers to a screen today, still takes an accepted answer and shows the rest as not checked", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "typedAnswer").id;

    // Earlier sittings today, before this run started: five answers already graded.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        attemptFixture({
          answeredAt: new Date(run.startedAt.getTime() - 60_000),
          isCorrect: false,
          stepId,
          userId: user.id,
        }),
      ),
    );

    const paraphrase = await check({
      answer: { kind: "typedAnswer", text: "Because it's probably around there" },
      runId: run.id,
      stepId,
    });

    const accepted = await check({
      answer: { kind: "typedAnswer", text: "it shows where the electron is likely to be." },
      runId: run.id,
      stepId,
    });

    // Not marked wrong: shown with the sample answer, not recorded, no mistake saved.
    expect(paraphrase).toMatchObject({
      result: {
        checked: false,
        correctAnswer:
          "Because we can't pin down where the electron is. The cloud maps where it's most likely to be.",
        feedback: null,
        keyPoints: null,
        savedMistake: false,
        score: null,
      },
      status: "checked",
    });

    expect(accepted).toMatchObject({ result: { checked: true, isCorrect: true, score: 1 } });
    expect(gradeTypedAnswer).not.toHaveBeenCalled();

    const [attempts, mistakes] = await Promise.all([
      prisma.attempt.count({
        where: { answeredAt: { gte: run.startedAt }, stepId, userId: user.id },
      }),
      prisma.mistake.count({ where: { stepId, userId: user.id } }),
    ]);

    expect([attempts, mistakes]).toStrictEqual([1, 0]);
  });

  it("records a guest's answers like anyone else's", async () => {
    const { run, steps, user } = await setupRun({ guest: true });

    const outcome = await check({
      answer: { kind: "check", optionId: "likely" },
      runId: run.id,
      stepId: stepOfKind(steps, "check").id,
    });

    expect(outcome.status).toBe("checked");
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("needs a session and a real step", async () => {
    mockSession(null);

    await expect(
      check({
        answer: { kind: "check", optionId: "a" },
        runId: randomUUID(),
        stepId: randomUUID(),
      }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    const learner = await userFixture();
    mockSession(learner.id);

    await expect(
      check({ answer: { kind: "check", optionId: "a" }, runId: randomUUID(), stepId: "nope" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
