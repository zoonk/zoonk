import { randomUUID } from "node:crypto";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getUsageRule } from "../entitlements/limits";
import { applyLevelEvidence } from "../language/levels/skill-level-rules";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { type LessonStepCheckOutcome, checkLessonStep } from "./check-lesson-step";
import { type LessonStepAnswer } from "./contract";
import type * as SkillLevelRules from "../language/levels/skill-level-rules";

// A write that fails for a moment (a dropped connection) can't be made safely with the real
// database: a test makes a language level's evidence fail once.
vi.mock("../language/levels/skill-level-rules", async (importOriginal) => {
  const actual = await importOriginal<typeof SkillLevelRules>();
  return { ...actual, applyLevelEvidence: vi.fn(actual.applyLevelEvidence) };
});

async function setupRun(options?: Parameters<typeof setupPlayableLesson>[0]) {
  const setup = await setupPlayableLesson(options);
  const run = await lessonRunFixture({ lessonId: setup.lesson.id, userId: setup.user.id });
  return { ...setup, run };
}

function check({
  answer,
  attemptId,
  runId,
  stepId,
  usedHelp,
}: {
  answer: LessonStepAnswer;
  attemptId?: string;
  runId: string;
  stepId: string;
  usedHelp?: boolean;
}) {
  return checkLessonStep({
    input: { answer, attemptId, durationMs: 8000, runId, timeZone: "UTC", usedHelp },
    stepId,
  });
}

/**
 * Runs `writes` while the learner's row is locked, and lets them go once `waiters` of them wait
 * on it: what they read before writing, they all read before any of them wrote.
 */
async function whileLearnerLocked<T>({
  userId,
  waiters,
  writes,
}: {
  userId: string;
  waiters: number;
  writes: () => Promise<T>;
}): Promise<T> {
  const holder = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const holding = prisma.$transaction(
    async (tx) => {
      const [{ pid }] = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() AS pid`;
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      holder.resolve(pid);
      await release.promise;
    },
    { timeout: 30_000 },
  );

  const pid = await holder.promise;
  const result = writes();

  await vi.waitFor(
    async () => {
      // A second waiter queues behind the first, so count everyone waiting down the line.
      const [{ count }] = await prisma.$queryRaw<[{ count: number }]>`
        WITH RECURSIVE waiting(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))
          UNION
          SELECT activity.pid FROM pg_stat_activity AS activity
          JOIN waiting ON waiting.pid = ANY(pg_blocking_pids(activity.pid))
        )
        SELECT count(*)::int AS count FROM waiting
      `;

      expect(count).toBe(waiters);
    },
    { interval: 20, timeout: 10_000 },
  );

  release.resolve(null);
  await holding;
  return result;
}

async function readRevision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    select: { learnerRevision: true },
    where: { id: userId },
  });

  return user.learnerRevision;
}

/** A model's grade of a written answer. */
function typedGrade({
  feedback,
  isCorrect,
  score,
}: {
  feedback: string;
  isCorrect: boolean;
  score: number;
}): Awaited<ReturnType<typeof gradeTypedAnswer>> {
  return {
    data: {
      corrections: [],
      feedback,
      isCorrect,
      keyPoints: [{ met: isCorrect, text: "The cloud shows where it's likely to be found" }],
      method: "model",
      score,
      spelling: null,
    },
    provenance: null,
    systemPrompt: "",
    usage: null,
    userPrompt: "",
  };
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

  it("records an answer sent again with its id once, and gives the same result", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "check").id;
    const attemptId = randomUUID();
    const answer = { kind: "check", optionId: "size" } as const;

    const first = await check({ answer, attemptId, runId: run.id, stepId });
    const revision = await readRevision(user.id);
    const again = await check({ answer, attemptId, runId: run.id, stepId });

    expect(first).toMatchObject({ result: { savedMistake: true }, status: "checked" });
    expect(again).toStrictEqual(first);

    await expect(prisma.attempt.count({ where: { stepId, userId: user.id } })).resolves.toBe(1);

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(readRevision(user.id)).resolves.toBe(revision);
  });

  it("records the same answer sent twice at once a single time", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "check").id;
    const attemptId = randomUUID();
    const answer = { kind: "check", optionId: "size" } as const;
    const revision = await readRevision(user.id);

    // Both requests look for the id before either records it, then queue on the learner's row.
    const outcomes = await whileLearnerLocked({
      userId: user.id,
      waiters: 2,
      writes: () =>
        Promise.all([
          check({ answer, attemptId, runId: run.id, stepId }),
          check({ answer, attemptId, runId: run.id, stepId }),
        ]),
    });

    expect(outcomes).toStrictEqual([outcomes[0], outcomes[0]]);
    expect(outcomes[0]).toMatchObject({ result: { savedMistake: true }, status: "checked" });

    await expect(prisma.attempt.count({ where: { stepId, userId: user.id } })).resolves.toBe(1);

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(readRevision(user.id)).resolves.toBe(revision + 1n);
  });

  it("keeps two learners' answers apart when they send the same id", async () => {
    const [mine, theirs] = await Promise.all([setupRun(), setupRun()]);
    const attemptId = randomUUID();
    const answer = { kind: "check", optionId: "likely" } as const;

    mockSession(mine.user.id);

    const myOutcome = await check({
      answer,
      attemptId,
      runId: mine.run.id,
      stepId: stepOfKind(mine.steps, "check").id,
    });

    mockSession(theirs.user.id);

    const theirOutcome = await check({
      answer: { kind: "check", optionId: "size" },
      attemptId,
      runId: theirs.run.id,
      stepId: stepOfKind(theirs.steps, "check").id,
    });

    expect(myOutcome).toMatchObject({ result: { isCorrect: true }, status: "checked" });
    expect(theirOutcome).toMatchObject({ result: { isCorrect: false, savedMistake: true } });

    const counts = await Promise.all(
      [mine.user.id, theirs.user.id].map((userId) => prisma.attempt.count({ where: { userId } })),
    );

    expect(counts).toStrictEqual([1, 1]);
  });

  it("records an answer to another screen sent with an id already used here", async () => {
    const { lesson, run, user } = await setupRun({ steps: ["check", "check"] });

    const [first, second] = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    const attemptId = randomUUID();
    const answer = { kind: "check", optionId: "likely" } as const;

    await check({ answer, attemptId, runId: run.id, stepId: first?.id ?? "" });
    await check({ answer, attemptId, runId: run.id, stepId: second?.id ?? "" });
    // Sent again, the other screen's answer is recorded once too.
    await check({ answer, attemptId, runId: run.id, stepId: second?.id ?? "" });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it("doesn't record an answer whose run was finished while it was graded", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "typedAnswer").id;
    const revision = await readRevision(user.id);

    vi.mocked(gradeTypedAnswer).mockImplementationOnce(async () => {
      // The learner finished the lesson while the answer was still being graded.
      await prisma.learningEvent.update({ data: { endedAt: new Date() }, where: { id: run.id } });

      return {
        data: {
          corrections: [],
          feedback: "Both ideas are there.",
          isCorrect: true,
          keyPoints: [{ met: true, text: "We can't know the electron's exact position or path" }],
          method: "model",
          score: 1,
          spelling: null,
        },
        provenance: null,
        systemPrompt: "",
        usage: null,
        userPrompt: "",
      };
    });

    const outcome = await check({
      answer: { kind: "typedAnswer", text: "We only know where it probably is" },
      attemptId: randomUUID(),
      runId: run.id,
      stepId,
    });

    expect(outcome).toStrictEqual({ status: "runEnded" });
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(readRevision(user.id)).resolves.toBe(revision);
  });

  it("doesn't record a grade the screen stopped waiting for once the answer checked after it was recorded", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "typedAnswer").id;
    const entered = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    vi.mocked(gradeTypedAnswer).mockImplementationOnce(async () => {
      entered.resolve(null);
      await release.promise;
      return typedGrade({ feedback: "Only half of it.", isCorrect: false, score: 0.4 });
    });

    const slow = check({
      answer: { kind: "typedAnswer", text: "It's where the electron is" },
      attemptId: randomUUID(),
      runId: run.id,
      stepId,
    });

    await entered.promise;

    // The screen stopped waiting; the learner rewrote the answer and checked it again.
    vi.mocked(gradeTypedAnswer).mockResolvedValueOnce(
      typedGrade({ feedback: "Both ideas are there.", isCorrect: true, score: 1 }),
    );

    await expect(
      check({
        answer: { kind: "typedAnswer", text: "We only know where it probably is" },
        attemptId: randomUUID(),
        runId: run.id,
        stepId,
      }),
    ).resolves.toMatchObject({ result: { isCorrect: true }, status: "checked" });

    release.resolve(null);

    await expect(slow).resolves.toMatchObject({
      result: { isCorrect: false, savedMistake: false },
      status: "checked",
    });

    await expect(
      prisma.attempt.findMany({ select: { isCorrect: true }, where: { stepId, userId: user.id } }),
    ).resolves.toStrictEqual([{ isCorrect: true }]);
  });

  it("keeps an earlier answer first when its slow grade is saved before the answer checked after it", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "typedAnswer").id;
    const graders = [Promise.withResolvers<null>(), Promise.withResolvers<null>()] as const;
    const entered = [Promise.withResolvers<null>(), Promise.withResolvers<null>()] as const;

    vi.mocked(gradeTypedAnswer)
      .mockImplementationOnce(async () => {
        entered[0].resolve(null);
        await graders[0].promise;
        return typedGrade({ feedback: "Only half of it.", isCorrect: false, score: 0.4 });
      })
      .mockImplementationOnce(async () => {
        entered[1].resolve(null);
        await graders[1].promise;
        return typedGrade({ feedback: "Both ideas are there.", isCorrect: true, score: 1 });
      });

    const earlier = check({
      answer: { kind: "typedAnswer", text: "It's where the electron is" },
      attemptId: randomUUID(),
      runId: run.id,
      stepId,
    });

    await entered[0].promise;

    const later = check({
      answer: { kind: "typedAnswer", text: "We only know where it probably is" },
      attemptId: randomUUID(),
      runId: run.id,
      stepId,
    });

    await entered[1].promise;

    graders[0].resolve(null);
    await expect(earlier).resolves.toMatchObject({ result: { isCorrect: false } });
    graders[1].resolve(null);
    await expect(later).resolves.toMatchObject({ result: { isCorrect: true } });

    await expect(
      prisma.attempt.findMany({
        orderBy: { answeredAt: "asc" },
        select: { isCorrect: true },
        where: { stepId, userId: user.id },
      }),
    ).resolves.toStrictEqual([{ isCorrect: false }, { isCorrect: true }]);
  });

  it("records an answer given just before midnight and saved after another screen's answer on its skill", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T23:59:50Z"));

    try {
      const { lesson, run, skill, user } = await setupRun({
        steps: ["typedAnswer", "typedAnswer"],
      });

      const [first, second] = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: lesson.id },
      });

      const entered = Promise.withResolvers<null>();
      const release = Promise.withResolvers<null>();

      vi.mocked(gradeTypedAnswer)
        .mockImplementationOnce(async () => {
          entered.resolve(null);
          await release.promise;
          return typedGrade({ feedback: "Only half of it.", isCorrect: false, score: 0.4 });
        })
        .mockResolvedValueOnce(
          typedGrade({ feedback: "Both ideas are there.", isCorrect: true, score: 1 }),
        );

      const beforeMidnight = check({
        answer: { kind: "typedAnswer", text: "It's where the electron is" },
        runId: run.id,
        stepId: first?.id ?? "",
      });

      await entered.promise;

      // The next screen, on the same skill, is answered and saved after midnight.
      vi.setSystemTime(new Date("2026-09-02T00:00:05Z"));

      await expect(
        check({
          answer: { kind: "typedAnswer", text: "We only know where it probably is" },
          runId: run.id,
          stepId: second?.id ?? "",
        }),
      ).resolves.toMatchObject({ result: { isCorrect: true }, status: "checked" });

      release.resolve(null);

      await expect(beforeMidnight).resolves.toMatchObject({
        result: { isCorrect: false },
        status: "checked",
      });

      // Each answer keeps when it was given and its own day; only the skill's memory moves on.
      await expect(
        prisma.attempt.findMany({
          orderBy: { answeredAt: "asc" },
          select: { answeredAt: true, localDate: true },
          where: { userId: user.id },
        }),
      ).resolves.toStrictEqual([
        { answeredAt: new Date("2026-09-01T23:59:50Z"), localDate: new Date("2026-09-01") },
        { answeredAt: new Date("2026-09-02T00:00:05Z"), localDate: new Date("2026-09-02") },
      ]);

      await expect(
        prisma.learnerSkill.findFirstOrThrow({
          select: { lastReviewedAt: true },
          where: { skillId: skill.id, userId: user.id },
        }),
      ).resolves.toStrictEqual({ lastReviewedAt: new Date("2026-09-02T00:00:05Z") });
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives a written answer sent twice at once the saved grade, never the other request's words", async () => {
    const { run, steps } = await setupRun();
    const stepId = stepOfKind(steps, "typedAnswer").id;
    const entered = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    const sent = {
      answer: { kind: "typedAnswer", text: "We only know where it probably is" },
      attemptId: randomUUID(),
      runId: run.id,
      stepId,
    } as const;

    vi.mocked(gradeTypedAnswer)
      .mockImplementationOnce(async () => {
        entered.resolve(null);
        await release.promise;
        return typedGrade({ feedback: "The first grader's words.", isCorrect: true, score: 1 });
      })
      .mockResolvedValueOnce(
        typedGrade({ feedback: "The second grader's words.", isCorrect: true, score: 0.8 }),
      );

    const first = check(sent);
    await entered.promise;
    const second = await check(sent);
    release.resolve(null);

    expect(second).toMatchObject({
      result: { feedback: "The second grader's words.", score: 0.8 },
    });

    await expect(first).resolves.toMatchObject({
      result: { checked: true, feedback: null, isCorrect: true, keyPoints: null, score: 0.8 },
      status: "checked",
    });
  });

  it("saves a language answer with its evidence or neither, so one sent again saves both", async () => {
    const [user, { lesson, steps, word }] = await Promise.all([
      userFixture(),
      languageLessonFixture(),
    ]);

    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
    mockSession(user.id);

    const sent = {
      answer: { kind: "translation", selectedOptionId: word.id },
      attemptId: randomUUID(),
      runId: run.id,
      stepId: stepOfKind(steps, "translation").id,
    } as const;

    vi.mocked(applyLevelEvidence).mockImplementationOnce(() => {
      throw new Error("Connection terminated unexpectedly");
    });

    await expect(check(sent)).rejects.toThrow("Connection terminated unexpectedly");
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(check(sent)).resolves.toMatchObject({
      result: { isCorrect: true },
      status: "checked",
    });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      prisma.languageSkillLevel.findMany({
        select: { windowCorrect: true, windowTotal: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([{ windowCorrect: 1, windowTotal: 1 }]);

    await expect(
      prisma.learnerWord.count({ where: { userId: user.id, wordId: word.id } }),
    ).resolves.toBe(1);
  });

  it("gives a written answer the model graded its saved verdict when it's sent again", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "typedAnswer").id;
    const attemptId = randomUUID();
    const answer = { kind: "typedAnswer", text: "We only know where it probably is" } as const;

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

    const first = await check({ answer, attemptId, runId: run.id, stepId });
    const again = await check({ answer, attemptId, runId: run.id, stepId });

    expect(first).toMatchObject({ result: { checked: true, isCorrect: true, score: 1 } });
    expect(again).toMatchObject({ result: { checked: true, isCorrect: true, score: 1 } });
    expect(gradeTypedAnswer).toHaveBeenCalledOnce();
    await expect(prisma.attempt.count({ where: { stepId, userId: user.id } })).resolves.toBe(1);
  });

  it("says a miss sent again was saved when its question was already in the notebook", async () => {
    const { run, steps, user } = await setupRun();
    const stepId = stepOfKind(steps, "check").id;
    const attemptId = randomUUID();
    const answer = { kind: "check", optionId: "size" } as const;

    await mistakeFixture({ createdAt: new Date(Date.now() - 86_400_000), stepId, userId: user.id });

    const first = await check({ answer, attemptId, runId: run.id, stepId });
    const again = await check({ answer, attemptId, runId: run.id, stepId });

    expect(first).toMatchObject({ result: { savedMistake: true } });
    expect(again).toStrictEqual(first);
  });

  it("saves a miss on a screen without its own skill under the lesson's first skill, so the notebook lists it", async () => {
    const { lesson, run, skill, steps, user } = await setupRun();
    const other = await skillFixture();
    await lessonSkillFixture({ lessonId: lesson.id, skillId: other.id });
    const step = stepOfKind(steps, "check");

    await check({ answer: { kind: "check", optionId: "size" }, runId: run.id, stepId: step.id });

    const [mistake, attempt] = await Promise.all([
      prisma.mistake.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.attempt.findFirstOrThrow({ where: { stepId: step.id, userId: user.id } }),
    ]);

    expect(mistake).toMatchObject({ skillId: skill.id, status: "open", stepId: step.id });
    expect(attempt.skillId).toBe(skill.id);
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

  it("shows a typed fallback that misses a word as the sentence typed, then as it reads", async () => {
    const { run, steps } = await setupRun();

    const outcome = await check({
      answer: { kind: "spokenAnswer", text: "The electrons is cloud" },
      runId: run.id,
      stepId: stepOfKind(steps, "spokenAnswer").id,
    });

    expect(outcome).toMatchObject({
      result: {
        corrections: [{ right: "The electron is a cloud", wrong: "The electrons is cloud" }],
        isCorrect: false,
      },
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
