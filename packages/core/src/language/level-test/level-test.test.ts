import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { listOwed } from "../../_test-utils/follow-ups";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import * as ownedGoalFact from "../../learner/facts/owned-goal";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { skipAlphabetIntro } from "../alphabet/skip-alphabet-intro";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { type LanguageLevelTestView, type LevelTestBank } from "./level-test-contract";
import { appendLevelTestChecks, readLevelTestCheckShortage } from "./replenish-level-test-checks";
import { startLanguageLevelTest } from "./start-language-level-test";

const TEST_LEVELS = CEFR_LEVELS;

const BANK: LevelTestBank = {
  questions: TEST_LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 1,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d"],
        passage: `${skill} passage ${level}`,
        question: "O que diz a mensagem?",
        skill,
      })),
    ),
  ),
  speaking: TEST_LEVELS.map((level) => ({ level, sentence: `Say ${level}`, translation: "Diga" })),
};

async function saveBank(targetLanguage = "en") {
  await prisma.languageLevelTest.upsert({
    create: {
      content: BANK,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage,
    },
    update: { content: BANK },
    where: { languagePair: { language: "pt", targetLanguage } },
  });
}

async function answerNextQuestion(goalId: string): Promise<string> {
  const view = await getLanguageLevelTest(goalId);

  const questionId =
    view.status === "ready" && view.test.status === "ready" && view.test.next.kind === "question"
      ? view.test.next.question.id
      : "";

  await answerLanguageLevelTest({ goalId, input: { answerIndex: 1, questionId } });
  return questionId;
}

function readFinishState({ goalId, userId }: { goalId: string; userId: string }) {
  return Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId } }),
  ]);
}

describe("language level test", () => {
  it.each([
    { showAlphabetNote: false, targetLanguage: "hmn" },
    { showAlphabetNote: false, targetLanguage: "ber" },
    { showAlphabetNote: true, targetLanguage: "ja" },
    { showAlphabetNote: false, targetLanguage: "sr-Latn" },
  ])(
    "uses the alphabet intro decision for $targetLanguage",
    async ({ showAlphabetNote, targetLanguage }) => {
      const { goal, user } = await languageGoalFixture();
      await prisma.goal.update({ data: { targetLanguage }, where: { id: goal.id } });
      await prisma.languageLevelTest.deleteMany({ where: { language: "pt", targetLanguage } });
      mockSession(user.id);

      await expect(getLanguageLevelTest(goal.id)).resolves.toMatchObject({
        status: "ready",
        test: { showAlphabetNote, status: "preparing" },
      });

      await saveBank(targetLanguage);

      await expect(getLanguageLevelTest(goal.id)).resolves.toMatchObject({
        status: "ready",
        test: { showAlphabetNote, status: "ready" },
      });

      await expect(skipAlphabetIntro(goal.id)).resolves.toStrictEqual({
        status: showAlphabetNote ? "skipped" : "notLanguage",
      });
    },
  );

  it("asks questions near the learner's level, checks only the current one, and sets levels", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const first = await getLanguageLevelTest(goal.id);

    expect(first).toMatchObject({
      status: "ready",
      test: {
        answered: 0,
        next: { kind: "question", question: { level: "A2", skill: "reading" } },
      },
    });

    const wrongQuestion = await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, questionId: "listening-C1-0" },
    });

    expect(wrongQuestion).toMatchObject({
      status: "ready",
      test: { answered: 0, next: { kind: "question", question: { id: "reading-A2-0" } } },
    });

    const answered = await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, questionId: "reading-A2-0" },
    });

    expect(answered).toMatchObject({ status: "ready", test: { answered: 1, lastCorrect: true } });

    const answeredLevels =
      answered.status === "ready" && answered.test.status === "ready"
        ? answered.test.levels.map((level) => level.skill)
        : [];

    expect(answeredLevels).toStrictEqual(["reading"]);

    const finished = await finishLanguageLevelTest(goal.id);

    expect(finished.status).toBe("ready");

    expect(
      finished.status === "ready" ? finished.levels.map((level) => level.skill) : [],
    ).toStrictEqual(["reading"]);

    const [levels, saved] = await Promise.all([
      prisma.languageSkillLevel.findMany({ where: { language: "en", userId: user.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(levels.map((level) => level.skill).toSorted()).toStrictEqual(["reading"]);

    expect(levels.every((level) => level.score === level.startScore)).toBe(true);
    const readingLevel = CEFR_LEVELS[levels[0]?.score ?? -1];

    expect(saved.details).toMatchObject({
      levelTest: { lastResult: { ranges: { reading: { low: readingLevel } } } },
      skillLevels: { reading: readingLevel },
    });

    expect(saved.details).toHaveProperty("level", "A2");
    expect(saved.details).not.toHaveProperty("skillLevels.speaking");
    expect(saved.details).not.toHaveProperty("skillLevels.writing");
  });

  it("shows an answer on the read right after it, whatever the goal's private cache still holds", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    // Vitest runs private caches as plain calls. This one keeps the goal from before the answer, as
    // `next dev` serves it to the next read.
    const before = await ownedGoalFact.readOwnedGoal(user.id, goal.id);
    const cached = vi.spyOn(ownedGoalFact, "readOwnedGoal").mockResolvedValue(before);

    try {
      await answerLanguageLevelTest({
        goalId: goal.id,
        input: { answerIndex: 1, questionId: "reading-A2-0" },
      });

      await expect(getLanguageLevelTest(goal.id)).resolves.toMatchObject({
        test: { answered: 1, next: { question: { id: "listening-A2-0" } } },
      });
    } finally {
      cached.mockRestore();
    }
  });

  it("saves one of two submissions of the same question that raced, and refuses the other", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const answer = () =>
      answerLanguageLevelTest({
        goalId: goal.id,
        input: { answerIndex: 1, questionId: "reading-A2-0" },
      });

    const writer = holdLearnerLock({ userId: user.id });
    const pid = await writer.pid;
    const both = Promise.all([answer(), answer()]);
    await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    writer.release();
    await writer.done;

    const results = await both;
    expect(results.map((result) => result.status).toSorted()).toStrictEqual(["invalid", "ready"]);
  });

  it("counts the time the test took as study time, once", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, durationMs: 40_000, questionId: "reading-A2-0" },
    });

    const next = await getLanguageLevelTest(goal.id);

    const questionId =
      next.status === "ready" && next.test.status === "ready" && next.test.next.kind === "question"
        ? next.test.next.question.id
        : "";

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 0, durationMs: 20_000, questionId },
    });

    await finishLanguageLevelTest(goal.id);
    await finishLanguageLevelTest(goal.id);

    const events = await prisma.learningEvent.findMany({
      where: { goalId: goal.id, lessonKind: "levelTest", userId: user.id },
    });

    const progress = await prisma.dailyProgress.findMany({ where: { userId: user.id } });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ correctAnswers: 1, incorrectAnswers: 1, seconds: 60 });
    expect(progress.reduce((sum, day) => sum + day.timeSpentSeconds, 0)).toBe(60);
  });

  it("lets a listening question whose audio couldn't be made be skipped, without counting it", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await expect(
      answerLanguageLevelTest({
        goalId: goal.id,
        input: { answerIndex: null, questionId: "reading-A2-0", skipped: true },
      }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, durationMs: 30_000, questionId: "reading-A2-0" },
    });

    const skipped = await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: null, durationMs: 50_000, questionId: "listening-A2-0", skipped: true },
    });

    expect(skipped).toMatchObject({
      status: "ready",
      test: {
        answered: 2,
        lastCorrect: null,
        levels: [{ label: expect.any(String), score: expect.any(Number), skill: "reading" }],
        next: { kind: "question", question: { skill: "reading" } },
      },
    });

    await finishLanguageLevelTest(goal.id);

    await expect(
      prisma.learningEvent.findFirst({
        where: { goalId: goal.id, lessonKind: "levelTest", userId: user.id },
      }),
    ).resolves.toMatchObject({ correctAnswers: 1, incorrectAnswers: 0, seconds: 30 });
  });

  it("marks finish details and skill levels once when an identical retry writes equal values", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);
    const first = await finishLanguageLevelTest(goal.id);
    expect(first.status).toBe("ready");

    const saved = await prisma.languageSkillLevel.findMany({
      orderBy: { skill: "asc" },
      where: { userId: user.id },
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    const retry = await finishLanguageLevelTest(goal.id);
    expect(retry).toStrictEqual(first);

    await expect(
      prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId: user.id } }),
    ).resolves.toStrictEqual(saved);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ inputVersion: plan.inputVersion });
  });

  it("finishes the same test again without moving its levels or what lessons showed since", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, durationMs: 40_000, questionId: "reading-A2-0" },
    });

    const first = await finishLanguageLevelTest(goal.id);

    await prisma.languageSkillLevel.update({
      data: { score: 2, windowCeiling: 1.5, windowCorrect: 2, windowTotal: 3 },
      where: { userLanguageSkill: { language: "en", skill: "reading", userId: user.id } },
    });

    const owner = { goalId: goal.id, userId: user.id };
    const before = await readFinishState(owner);
    const retry = await finishLanguageLevelTest(goal.id);

    expect(retry).toStrictEqual(first);
    await expect(readFinishState(owner)).resolves.toStrictEqual(before);

    await expect(
      prisma.learningEvent.count({ where: { goalId: goal.id, lessonKind: "levelTest" } }),
    ).resolves.toBe(1);
  });

  it("settles two finishes that raced once, with the same levels for both", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    await prisma.plan.delete({ where: { goalId: goal.id } });
    mockSession(user.id);

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, durationMs: 40_000, questionId: "reading-A2-0" },
    });

    const writer = holdLearnerLock({ userId: user.id });
    const pid = await writer.pid;
    const both = Promise.all([finishLanguageLevelTest(goal.id), finishLanguageLevelTest(goal.id)]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      writer.release();
      await writer.done;
    }

    const [one, other] = await both;
    expect(one).toStrictEqual(other);

    await expect(
      prisma.learningEvent.count({ where: { goalId: goal.id, lessonKind: "levelTest" } }),
    ).resolves.toBe(1);
  });

  it("ends a test finished early, so reading it again shows its result instead of a question", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await answerNextQuestion(goal.id);
    const unanswered = await getLanguageLevelTest(goal.id);

    const questionId =
      unanswered.status === "ready" &&
      unanswered.test.status === "ready" &&
      unanswered.test.next.kind === "question"
        ? unanswered.test.next.question.id
        : "";

    const finished = await finishLanguageLevelTest(goal.id);

    await expect(getLanguageLevelTest(goal.id)).resolves.toMatchObject({
      status: "ready",
      test: { answered: 1, next: { kind: "done" }, status: "ready" },
    });

    await expect(
      answerLanguageLevelTest({ goalId: goal.id, input: { answerIndex: 1, questionId } }),
    ).resolves.toMatchObject({ status: "ready", test: { answered: 1, next: { kind: "done" } } });

    await expect(finishLanguageLevelTest(goal.id)).resolves.toStrictEqual(finished);
  });

  it("takes the finish marker before progress and serializes identical finish requests", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    await prisma.plan.delete({ where: { goalId: goal.id } });
    mockSession(user.id);

    const holder = holdLearnerLock({
      beforeCommit: async (transaction) => {
        await transaction.userProgress.upsert({
          create: { userId: user.id },
          update: {},
          where: { userId: user.id },
        });

        await transaction.$queryRaw`SELECT id FROM user_progress WHERE user_id = ${user.id}::uuid FOR UPDATE`;
      },
      userId: user.id,
    });

    const pid = await holder.pid;
    const both = Promise.all([finishLanguageLevelTest(goal.id), finishLanguageLevelTest(goal.id)]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, both]);
    }

    await expect(both).resolves.toHaveLength(2);
  });

  it("doesn't test a goal of another kind", async () => {
    const { user } = await languageGoalFixture();

    const other = await prisma.goal.create({
      data: {
        dailyMinutes: 20,
        displayName: "Physics",
        kind: "learn",
        language: "en",
        prompt: "physics",
        title: "Physics",
        userId: user.id,
      },
    });

    mockSession(user.id);

    await expect(getLanguageLevelTest(other.id)).resolves.toStrictEqual({ status: "notLanguage" });
  });

  it("reads a malformed goal id as missing", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getLanguageLevelTest("not-a-goal")).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      answerLanguageLevelTest({
        goalId: "not-a-goal",
        input: { answerIndex: 1, questionId: "reading-A2-0" },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe("level test on a non-Latin script", () => {
  it("saves the reading level with the result, which a repeat keeps", async () => {
    await saveBank("ja");
    const { goal, user, plan } = await languageGoalFixture();
    await prisma.goal.update({ data: { targetLanguage: "ja" }, where: { id: goal.id } });
    mockSession(user.id);

    const readReading = () =>
      prisma.languageSkillLevel.findUniqueOrThrow({
        where: { userLanguageSkill: { language: "ja", skill: "reading", userId: user.id } },
      });

    await answerNextQuestion(goal.id);
    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    const lessons = await prisma.languageSkillLevel.update({
      data: { windowCeiling: 1.5, windowCorrect: 2, windowTotal: 3 },
      where: { userLanguageSkill: { language: "ja", skill: "reading", userId: user.id } },
    });

    await finishLanguageLevelTest(goal.id);
    await expect(readReading()).resolves.toStrictEqual(lessons);
  });
});

describe("a post-start level test", () => {
  it("opens one attempt, seeds a retake from lessons, and preserves the prior result", async () => {
    const { goal, user } = await languageGoalFixture();
    const levels = { level: "none" };
    const pair = { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };

    await Promise.all([
      prisma.goal.update({ data: { ...pair, details: levels }, where: { id: goal.id } }),
      prisma.languageLevelTest.create({
        data: {
          ...pair,
          content: { ...BANK, confirmations: [] },
          model: "test",
          promptVersion: "test",
          runId: "test",
        },
      }),
    ]);

    mockSession(user.id);

    const [started, resumed] = await Promise.all([
      startLanguageLevelTest({ goalId: goal.id, length: "quick" }),
      startLanguageLevelTest({ goalId: goal.id, length: "quick" }),
    ]);

    expect(started).toStrictEqual(resumed);

    if (
      started.status !== "ready" ||
      started.test.status !== "ready" ||
      started.test.next.kind !== "question" ||
      !started.test.attemptId
    ) {
      throw new Error("Expected the first question");
    }

    const { attemptId, next } = started.test;
    expect(next.question.level).toBe("A1");

    await expect(
      answerLanguageLevelTest({
        goalId: goal.id,
        input: { answerIndex: 1, attemptId, questionId: next.question.id },
      }),
    ).resolves.toMatchObject({ status: "ready", test: { answered: 1 } });

    const previous = await finishLanguageLevelTest(goal.id, attemptId);

    expect(previous).toMatchObject({
      levels: [{ skill: "reading" }],
      result: { attemptId, ranges: { reading: expect.any(Object) } },
      status: "ready",
    });

    const lessonMoved = await prisma.languageSkillLevel.update({
      data: { raisedAt: new Date(), score: 4, windowCeiling: 4, windowCorrect: 5, windowTotal: 6 },
      where: {
        userLanguageSkill: { language: pair.targetLanguage, skill: "reading", userId: user.id },
      },
    });

    const partialWindow = await prisma.languageSkillLevel.create({
      data: {
        language: pair.targetLanguage,
        score: 3,
        skill: "listening",
        startScore: 3,
        userId: user.id,
        windowCeiling: 4,
        windowCorrect: 2,
        windowTotal: 3,
      },
    });

    const retake = await startLanguageLevelTest({ goalId: goal.id, length: "wholeCourse" });

    if (
      retake.status !== "ready" ||
      retake.test.status !== "ready" ||
      retake.test.next.kind !== "question" ||
      !retake.test.attemptId
    ) {
      throw new Error("Expected the retake's first question");
    }

    const nextAttemptId = retake.test.attemptId;
    expect(nextAttemptId).not.toBe(attemptId);

    expect(retake.test).toMatchObject({
      length: "wholeCourse",
      next: { question: { level: "C1" } },
      result: { attemptId },
    });

    await expect(finishLanguageLevelTest(goal.id, attemptId)).resolves.toStrictEqual(previous);

    await expect(
      answerLanguageLevelTest({
        goalId: goal.id,
        input: { answerIndex: 1, attemptId, questionId: retake.test.next.question.id },
      }),
    ).resolves.toMatchObject({ status: "ready", test: { next: { kind: "done" } } });

    const resumedQuestion = await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 0, attemptId: nextAttemptId, questionId: retake.test.next.question.id },
    });

    if (resumedQuestion.status !== "ready") {
      throw new Error(`Answer returned ${resumedQuestion.status}`);
    }

    expect(resumedQuestion.test).toMatchObject({ answered: 1 });

    await completeTapTest({
      attemptId: nextAttemptId,
      goalId: goal.id,
      test: resumedQuestion.test,
    });

    await expect(finishLanguageLevelTest(goal.id, nextAttemptId)).resolves.toMatchObject({
      result: { wholeCourseReady: true },
      status: "ready",
    });

    await expect(
      startLanguageLevelTest({ goalId: goal.id, length: "quick" }),
    ).resolves.toMatchObject({
      status: "ready",
      test: { attemptId: nextAttemptId, result: { wholeCourseReady: true } },
    });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({ where: { id: partialWindow.id } }),
    ).resolves.toMatchObject({ windowCeiling: 4, windowCorrect: 2, windowTotal: 3 });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({ where: { id: lessonMoved.id } }),
    ).resolves.toStrictEqual(lessonMoved);
  });

  it("can confirm a missed level on a later day after its shared bank is replenished", async () => {
    const { goal, skills, user } = await languageGoalFixture();
    const pair = { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };

    const confirmations = CEFR_LEVELS.flatMap((level) =>
      (["reading", "listening"] as const).flatMap((skill) =>
        [0, 1].map((index) => ({
          answerIndices: [0, 2],
          id: `confirm-${skill}-${level}-${index}`,
          level,
          options: ["a", "b", "c", "d", "e"],
          passage: `${skill} ${level} ${index}`,
          question: "What does it say?",
          skill,
        })),
      ),
    );

    await Promise.all([
      prisma.goal.update({ data: { ...pair, details: { level: "C2" } }, where: { id: goal.id } }),
      prisma.languageLevelTest.create({
        data: {
          ...pair,
          content: { ...BANK, confirmations },
          model: "test",
          promptVersion: "test",
          runId: "test",
        },
      }),
      prisma.skill.updateMany({
        data: { cefrLevel: "B2" },
        where: { id: { in: skills.map(({ id }) => id) } },
      }),
    ]);

    mockSession(user.id);

    const start = async () => {
      const started = await startLanguageLevelTest({ goalId: goal.id, length: "quick" });

      if (started.status !== "ready" || !started.test.attemptId) {
        throw new Error("Expected a Quick test");
      }

      return { attemptId: started.test.attemptId, goalId: goal.id, test: started.test };
    };

    const missed: string[] = [];
    const first = await start();

    await completeTapTest({
      ...first,
      confirm: ({ id }) => {
        if (missed.length === 0) {
          missed.push(id);
          return [];
        }

        return [2, 0];
      },
    });

    expect(missed).toStrictEqual(["confirm-reading-B2-0"]);

    await expect(finishLanguageLevelTest(goal.id, first.attemptId)).resolves.toMatchObject({
      result: { lessonsSkipped: 0, levelsSkipped: [] },
      status: "ready",
    });

    const replenishment = { goalId: goal.id, level: "B2" as const, pair, userId: user.id };

    await expect(listOwed(user.id)).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: { goalId: goal.id, level: "B2", pair },
          kind: "replenishLevelTestChecks",
        }),
      ]),
    );

    await expect(readLevelTestCheckShortage(replenishment)).resolves.toHaveLength(4);

    const newQuestions = confirmations
      .filter(({ level }) => level === "B2")
      .map(({ passage, ...item }) => ({ ...item, passage: `A new example for ${passage}` }));

    const saved = { batchId: "test-refill", confirmations: newQuestions, pair };
    const written = await appendLevelTestChecks(saved);
    expect(written).toHaveLength(2);
    await expect(appendLevelTestChecks(saved)).resolves.toStrictEqual(written);
    await expect(readLevelTestCheckShortage(replenishment)).resolves.toBeNull();

    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      vi.setSystemTime(Date.now() + MS_PER_DAY);
      const retake = await start();
      const asked: string[] = [];

      await completeTapTest({
        ...retake,
        confirm: ({ id }) => {
          asked.push(id);
          return [2, 0];
        },
      });

      expect(asked).toHaveLength(4);
      expect(asked).not.toContain(missed[0]);
      expect(asked).toContain("confirmation-refill-test-refill-0");

      await expect(finishLanguageLevelTest(goal.id, retake.attemptId)).resolves.toMatchObject({
        result: {
          lessonsSkipped: expect.any(Number),
          levelsSkipped: expect.arrayContaining(["B2"]),
        },
        status: "ready",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips only fully tagged lessons and keeps both shown session blocks and Undo", async () => {
    const { goal, items, lessons, skills, user } = await languageGoalFixture();

    const pair = { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };

    const confirmations = CEFR_LEVELS.flatMap((level) =>
      (["reading", "listening"] as const).flatMap((skill) =>
        [0, 1].map((index) => ({
          answerIndices: [0, 2],
          id: `confirm-${skill}-${level}-${index}`,
          level,
          options: ["a", "b", "c", "d", "e"],
          passage: `${skill} ${level}`,
          question: "What does it say?",
          skill,
        })),
      ),
    );

    const [low, mixed, high] = skills;
    const [lowLesson, mixedLesson] = lessons;
    const [lowItem, mixedItem] = items;

    if (!low || !mixed || !high || !lowItem || !mixedItem || !lowLesson || !mixedLesson) {
      throw new Error("Expected the plan's lessons and skills");
    }

    await Promise.all([
      prisma.goal.update({ data: { ...pair, details: { level: "C2" } }, where: { id: goal.id } }),
      prisma.languageLevelTest.create({
        data: {
          ...pair,
          content: { ...BANK, confirmations },
          model: "test",
          promptVersion: "test",
          runId: "test",
        },
      }),
      prisma.skill.updateMany({
        data: { cefrLevel: "A1" },
        where: { id: { in: [low.id, mixed.id] } },
      }),
      prisma.skill.update({ data: { cefrLevel: "C2" }, where: { id: high.id } }),
      lessonSkillFixture({ lessonId: mixedLesson.id, skillId: high.id }),
    ]);

    const session = await studySessionFixture({
      goalId: goal.id,
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const blocks = await Promise.all(
      (["active", "pending"] as const).map((status, position) =>
        studySessionBlockFixture({
          lessonId: lowLesson.id,
          position,
          sessionId: session.id,
          status,
        }),
      ),
    );

    mockSession(user.id);
    const started = await startLanguageLevelTest({ goalId: goal.id, length: "quick" });

    if (started.status !== "ready" || !started.test.attemptId) {
      throw new Error("Expected a test attempt");
    }

    const { attemptId } = started.test;
    await completeTapTest({ attemptId, goalId: goal.id, test: started.test });

    const finished = await finishLanguageLevelTest(goal.id, attemptId);

    expect(finished).toMatchObject({
      result: {
        changeId: expect.any(String),
        lessonsSkipped: 1,
        levelsSkipped: expect.arrayContaining(["A1"]),
      },
      status: "ready",
    });

    await expect(prisma.planItem.findUnique({ where: { id: lowItem.id } })).resolves.toMatchObject({
      status: "testedOut",
    });

    await expect(
      prisma.planItem.findUnique({ where: { id: mixedItem.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    const readBlocks = () =>
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: session.id },
      });

    await expect(readBlocks()).resolves.toStrictEqual(blocks);

    if (finished.status !== "ready" || !finished.result?.changeId) {
      throw new Error("Expected the finish's Undo ID");
    }

    const { changeId } = finished.result;

    await expect(finishLanguageLevelTest(goal.id, attemptId)).resolves.toStrictEqual(finished);

    await expect(
      prisma.planChange.count({ where: { kind: "testedOut", planId: lowItem.planId } }),
    ).resolves.toBe(1);

    await expect(
      decidePlanChange({ changeId, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(prisma.planItem.findUnique({ where: { id: lowItem.id } })).resolves.toMatchObject({
      status: "todo",
    });

    await expect(finishLanguageLevelTest(goal.id, attemptId)).resolves.toMatchObject({
      result: { changeId: null, lessonsSkipped: 0, levelsSkipped: [] },
      status: "ready",
    });
  });
});

async function completeTapTest({
  attemptId,
  confirm = () => [2, 0],
  goalId,
  test,
}: {
  attemptId: string;
  confirm?: (question: { id: string }) => number[];
  goalId: string;
  test: LanguageLevelTestView;
}): Promise<void> {
  if (test.status !== "ready" || test.next.kind === "speaking") {
    throw new Error("Expected a tap question or a completed test");
  }

  if (test.next.kind === "done") {
    return;
  }

  const input =
    test.next.kind === "confirmation"
      ? { answerIndex: null, answerIndices: confirm(test.next.question) }
      : { answerIndex: 1 };

  const next = await answerLanguageLevelTest({
    goalId,
    input: { ...input, attemptId, questionId: test.next.question.id },
  });

  if (next.status !== "ready") {
    throw new Error(`Answer returned ${next.status}`);
  }

  await completeTapTest({ attemptId, confirm, goalId, test: next.test });
}
