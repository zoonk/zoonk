import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { GUEST_OUT_OF_HELP } from "../../_test-utils/guest-out-of-help";
import {
  holdLearnerRevision,
  readLearnerRevision,
  waitForBlockedStatement,
} from "../../_test-utils/learner-revision";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getUsageRule } from "../../entitlements/limits";
import * as learnerWrite from "../../learner/_utils/write-learner-change";
import { NEW_SKILL_MEMORY } from "../../learner/fsrs-scheduler";
import * as placement from "../../learner/placement/_utils/apply-placement";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import * as announcement from "../../plans/announce-tested-out-items";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { readGoalDetails } from "../_utils/language-goal";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { gradeLevelTestSpeech } from "./grade-level-test-speech";
import { type LevelTestBank } from "./level-test-contract";

const TEST_LEVELS = CEFR_LEVELS.slice(0, 5);

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

/** Answers the question the test asks now, rightly, and returns its id. */
async function answerNextQuestion(goalId: string): Promise<string> {
  const view = await getLanguageLevelTest(goalId);

  const questionId =
    view.status === "ready" && view.test.status === "ready" && view.test.next.kind === "question"
      ? view.test.next.question.id
      : "";

  await answerLanguageLevelTest({ goalId, input: { answerIndex: 1, questionId } });
  return questionId;
}

/** What a finish can change: the learner's revision, the goal and their skill levels. */
function readFinishState({ goalId, userId }: { goalId: string; userId: string }) {
  return Promise.all([
    readLearnerRevision(userId),
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId } }),
  ]);
}

/**
 * Pauses the next finish right after it settles the test, before it saves the levels, as a slow
 * request would; every write stays real.
 */
function pauseNextFinishAfterSettling() {
  const writeChange = learnerWrite.writeLearnerChange;
  const settled = Promise.withResolvers<null>();
  const resumed = Promise.withResolvers<null>();

  const paused = vi
    .spyOn(learnerWrite, "writeLearnerChange")
    .mockImplementationOnce(async (options, write) => {
      const written = await writeChange(options, write);
      settled.resolve(null);
      await resumed.promise;
      return written;
    });

  const resume = () => {
    resumed.resolve(null);
    paused.mockRestore();
  };

  return { resume, settled: settled.promise };
}

/** A test answered right up to B2 in reading and listening: B1 or above, past the A1–A2 band. */
const TESTED_UP_TO_B2 = {
  answers: ["reading", "listening"].flatMap((skill) =>
    ["A2", "B1", "B2"].map((level) => ({ answerIndex: 1, id: `${skill}-${level}-0` })),
  ),
  speaking: null,
};

/**
 * A learner right up to B2 in reading and listening (`TESTED_UP_TO_B2`), past the A1–A2 band of
 * their plan's first two units.
 */
async function placedLearnerFixture() {
  await saveBank();
  const { goal, items, lessons, user } = await languageGoalFixture();

  const [basics, onLevel] = await Promise.all([
    skillFixture({ language: "pt", level: "beginner", name: "Chegar ao aeroporto" }),
    skillFixture({ language: "pt", level: "intermediate", name: "Negociar o aluguel" }),
  ]);

  await Promise.all([
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: (index < 2 ? basics : onLevel).id }),
    ),
    prisma.goal.update({
      data: { details: { ...(goal.details as object), levelTest: TESTED_UP_TO_B2 } },
      where: { id: goal.id },
    }),
  ]);

  return { goal, itemIds: items.map((item) => item.id), user };
}

/**
 * The learner undid the test-out, as `undoChange` leaves it: its units are back to study and their
 * skills no longer assumed known. This fixture's plan isn't the planner's, so it has no change to undo.
 */
async function bringBackTestedOutUnits({ itemIds, userId }: { itemIds: string[]; userId: string }) {
  await Promise.all([
    prisma.planItem.updateMany({
      data: { completedAt: null, status: "todo" },
      where: { id: { in: itemIds } },
    }),
    prisma.learnerSkill.updateMany({ data: NEW_SKILL_MEMORY, where: { userId } }),
  ]);
}

async function readItemStatuses(itemIds: string[]) {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { status: true },
    where: { id: { in: itemIds } },
  });

  return items.map((item) => item.status);
}

describe("language level test", () => {
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

    expect(wrongQuestion).toStrictEqual({ status: "invalid" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(0n);

    const answered = await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, questionId: "reading-A2-0" },
    });

    expect(answered).toMatchObject({ status: "ready", test: { answered: 1, lastCorrect: true } });
    // The answer is saved on the goal the test screen reads: one change.
    await expect(readLearnerRevision(user.id)).resolves.toBe(1n);

    const answeredLevels =
      answered.status === "ready" && answered.test.status === "ready"
        ? answered.test.levels.map((level) => level.skill)
        : [];

    // Nothing in the test is written, so writing gets no level until lessons show one.
    expect(answeredLevels).toStrictEqual(["reading", "listening"]);

    const finished = await finishLanguageLevelTest(goal.id);

    expect(finished.status).toBe("ready");

    // The learner stopped before the sentence out loud: speaking wasn't tested, so it gets no level.
    expect(
      finished.status === "ready" ? finished.levels.map((level) => level.skill) : [],
    ).toStrictEqual(["reading", "listening"]);

    const [levels, saved] = await Promise.all([
      prisma.languageSkillLevel.findMany({ where: { language: "en", userId: user.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(levels.map((level) => level.skill).toSorted()).toStrictEqual(["listening", "reading"]);

    expect(levels.every((level) => level.score === level.startScore)).toBe(true);
    expect(saved.details).toMatchObject({ skillLevels: { reading: expect.any(String) } });
    expect(saved.details).not.toHaveProperty("skillLevels.speaking");
    expect(saved.details).not.toHaveProperty("skillLevels.writing");
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

    // Both read the test before either saves: another write holds the learner's revision.
    const writer = holdLearnerRevision({ userId: user.id });
    const pid = await writer.pid;
    const both = Promise.all([answer(), answer()]);
    await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    writer.release();
    await writer.done;

    const results = await both;
    expect(results.map((result) => result.status).toSorted()).toStrictEqual(["invalid", "ready"]);

    // The held writer's change and the one saved answer.
    await expect(readLearnerRevision(user.id)).resolves.toBe(2n);
  });

  // Marcos' level test took him minutes that his statistics never showed.
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

  it("marks finish details and skill levels once when an identical retry writes equal values", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);
    const before = await readLearnerRevision(user.id);
    const first = await finishLanguageLevelTest(goal.id);
    expect(first.status).toBe("ready");
    // The test's result with its levels, then marking it placed.
    expect.soft(await readLearnerRevision(user.id)).toBe(before + 2n);

    const saved = await prisma.languageSkillLevel.findMany({
      orderBy: { skill: "asc" },
      where: { userId: user.id },
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    const retry = await finishLanguageLevelTest(goal.id);
    expect(retry).toStrictEqual(first);
    expect.soft(await readLearnerRevision(user.id)).toBe(before + 2n);

    await expect(
      prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId: user.id } }),
    ).resolves.toStrictEqual(saved);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ inputVersion: plan.inputVersion });
  });

  // A retry of a finish whose response was lost moved the learner's level, and wiped what their
  // lessons had shown since.
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

  // A test ended before tests kept their start lost it to the level that finish set: finishing it
  // again scored it from that level, moved it, and wiped what lessons had shown since.
  it("keeps a test that ended before tests kept their start as it ended", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await Promise.all([
      prisma.goal.update({
        data: {
          details: {
            ...(goal.details as object),
            level: "B1",
            levelTest: { answers: TESTED_UP_TO_B2.answers.slice(0, 2), counted: 2, speaking: null },
            skillLevels: { listening: "A2+", reading: "B1+" },
          },
        },
        where: { id: goal.id },
      }),
      prisma.languageSkillLevel.create({
        data: {
          language: "en",
          score: 2,
          skill: "reading",
          startScore: 2.5,
          userId: user.id,
          windowCeiling: 1.5,
          windowCorrect: 2,
          windowTotal: 3,
        },
      }),
    ]);

    const owner = { goalId: goal.id, userId: user.id };
    const before = await readFinishState(owner);

    await expect(finishLanguageLevelTest(goal.id)).resolves.toStrictEqual({
      levels: [
        { label: "B1+", score: 2.5, skill: "reading" },
        { label: "A2+", score: 1.5, skill: "listening" },
      ],
      status: "ready",
    });

    await expect(readFinishState(owner)).resolves.toStrictEqual(before);
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

    const before = await readLearnerRevision(user.id);

    // Both read the test before either saves: another write holds the learner's revision.
    const writer = holdLearnerRevision({ userId: user.id });
    const pid = await writer.pid;
    const both = Promise.all([finishLanguageLevelTest(goal.id), finishLanguageLevelTest(goal.id)]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      writer.release();
      await writer.done;
    }

    const [one, other] = await both;
    expect(one).toStrictEqual(other);

    // The held writer's change, then the test's result with its levels and marking it placed, once.
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 3n);

    await expect(
      prisma.learningEvent.count({ where: { goalId: goal.id, lessonKind: "levelTest" } }),
    ).resolves.toBe(1);
  });

  it("never puts back the levels of a result a later finish replaced", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);
    await answerNextQuestion(goal.id);

    // Finishes save their levels, then fail to place them: neither result is applied yet.
    const placing = vi
      .spyOn(placement, "loadPlacement")
      .mockRejectedValueOnce(new Error("Plan busy"))
      .mockRejectedValueOnce(new Error("Plan busy"));

    const owner = { goalId: goal.id, userId: user.id };

    try {
      await expect(finishLanguageLevelTest(goal.id)).rejects.toThrow("Plan busy");
      const pause = pauseNextFinishAfterSettling();

      try {
        const retry = finishLanguageLevelTest(goal.id);
        await pause.settled;

        // Meanwhile the learner answers one more question and finishes again, with new levels.
        await answerNextQuestion(goal.id);
        await expect(finishLanguageLevelTest(goal.id)).rejects.toThrow("Plan busy");
        const [, latestGoal, latestSkills] = await readFinishState(owner);

        pause.resume();
        await retry;

        // The retry places the newer result, which its own finish left unplaced, at its levels.
        const [, goalAfter, skillsAfter] = await readFinishState(owner);
        const { level, skillLevels } = readGoalDetails(latestGoal);
        expect(skillsAfter).toStrictEqual(latestSkills);

        expect(goalAfter.details).toMatchObject({
          level,
          levelTest: { placement: { placed: true } },
          skillLevels,
        });
      } finally {
        pause.resume();
      }
    } finally {
      placing.mockRestore();
    }
  });

  it("keeps what lessons showed when a finish that stalled after settling the test goes on", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);
    await answerNextQuestion(goal.id);

    const placing = vi
      .spyOn(placement, "loadPlacement")
      .mockRejectedValueOnce(new Error("Plan busy"));

    const pause = pauseNextFinishAfterSettling();

    try {
      const stalled = finishLanguageLevelTest(goal.id);
      await pause.settled;

      // Meanwhile a retry fails to place the result, and lessons refine reading.
      await expect(finishLanguageLevelTest(goal.id)).rejects.toThrow("Plan busy");

      await prisma.languageSkillLevel.update({
        data: { score: 2, windowCeiling: 1.5, windowCorrect: 2, windowTotal: 3 },
        where: { userLanguageSkill: { language: "en", skill: "reading", userId: user.id } },
      });

      const lessons = await prisma.languageSkillLevel.findMany({
        orderBy: { skill: "asc" },
        where: { userId: user.id },
      });

      pause.resume();
      await stalled;

      await expect(
        prisma.languageSkillLevel.findMany({
          orderBy: { skill: "asc" },
          where: { userId: user.id },
        }),
      ).resolves.toStrictEqual(lessons);
    } finally {
      pause.resume();
      placing.mockRestore();
    }
  });

  // Ana stopped after one question, came back and answered one more: the test went on from the
  // level its first finish set instead of the one she gave.
  it("goes on with a test finished early from the level the learner gave", async () => {
    await saveBank();
    const [early, once] = await Promise.all([languageGoalFixture(), languageGoalFixture()]);

    mockSession(once.user.id);
    const firstOnce = await answerNextQuestion(once.goal.id);
    const secondOnce = await answerNextQuestion(once.goal.id);
    const finishedOnce = await finishLanguageLevelTest(once.goal.id);

    mockSession(early.user.id);
    const firstAsked = await answerNextQuestion(early.goal.id);
    await finishLanguageLevelTest(early.goal.id);
    const askedAfterFinish = await answerNextQuestion(early.goal.id);
    const finishedAgain = await finishLanguageLevelTest(early.goal.id);

    expect([firstAsked, askedAfterFinish]).toStrictEqual([firstOnce, secondOnce]);
    expect(finishedAgain).toStrictEqual(finishedOnce);

    const [earlyGoal, onceGoal] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: early.goal.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: once.goal.id } }),
    ]);

    const { level, skillLevels } = readGoalDetails(onceGoal);
    expect(earlyGoal.details).toMatchObject({ level, skillLevels });
  });

  it("takes the finish marker before progress and serializes identical finish requests", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    await prisma.plan.delete({ where: { goalId: goal.id } });
    mockSession(user.id);
    const before = await readLearnerRevision(user.id);

    const holder = holdLearnerRevision({
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
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, both]);
    }

    // The holder's change, then one finish's result with its levels and marking it placed.
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 3n);
  });

  it("sets the speaking level from the sentence said out loud", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const answers = ["reading", "listening"].flatMap((skill) =>
      ["A2", "B1", "B2"].map((level) => `${skill}-${level}-0`),
    );

    await prisma.goal.update({
      data: {
        details: {
          ...(goal.details as object),
          levelTest: { answers: answers.map((id) => ({ answerIndex: 1, id })), speaking: null },
        },
      },
      where: { id: goal.id },
    });

    vi.mocked(assessPronunciation).mockResolvedValue({
      data: {
        transcript: "Say B2",
        words: [
          { heard: null, issue: null, status: "correct", text: "Say" },
          { heard: null, issue: null, status: "correct", text: "B2" },
        ],
      },
      provenance: {
        generatedAt: "",
        latencyMs: 1,
        model: "m",
        promptVersion: "v",
        provider: "p",
        requestedModel: "m",
        runId: "r",
        usage: {},
      },
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });

    const result = await gradeLevelTestSpeech({
      audio: { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm" },
      goalId: goal.id,
    });

    expect(result).toMatchObject({
      heard: { score: 1 },
      status: "ready",
      test: { next: { kind: "done" } },
    });

    const speaking = result.status === "ready" ? result.test : null;

    const level =
      speaking?.status === "ready"
        ? speaking.levels.find((item) => item.skill === "speaking")
        : null;

    expect(level?.score).toBeGreaterThan(1);
  });

  it("asks a guest who used today's help to sign up before checking the sentence", async () => {
    freezeClock();

    await saveBank();
    const { goal, user } = await languageGoalFixture();

    const answers = ["reading", "listening"].flatMap((skill) =>
      ["A2", "B1", "B2"].map((level) => `${skill}-${level}-0`),
    );

    await Promise.all([
      prisma.goal.update({
        data: {
          details: {
            ...(goal.details as object),
            levelTest: { answers: answers.map((id) => ({ answerIndex: 1, id })), speaking: null },
          },
        },
        where: { id: goal.id },
      }),
      usageRecordsFixture({
        count: getUsageRule({ kind: "assist", tier: "guest" }).day ?? 0,
        createdAt: new Date(),
        kind: "assist",
        userId: user.id,
      }),
    ]);

    mockGuestSession(user.id);

    await expect(
      gradeLevelTestSpeech({
        audio: { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm" },
        goalId: goal.id,
      }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    expect(assessPronunciation).not.toHaveBeenCalled();
  });

  it("starts the plan at the level: units of a band below it are tested out", async () => {
    const { goal, itemIds, user } = await placedLearnerFixture();
    mockSession(user.id);

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });

    await expect(readItemStatuses(itemIds)).resolves.toStrictEqual([
      "testedOut",
      "testedOut",
      "todo",
      "todo",
    ]);

    // Finishing again places nothing new: the units it tested out stay, and nothing changes.
    const revision = await readLearnerRevision(user.id);
    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(revision);
  });

  it("keeps the units the learner brought back when the test is finished again", async () => {
    const { goal, itemIds, user } = await placedLearnerFixture();
    mockSession(user.id);
    await finishLanguageLevelTest(goal.id);

    await bringBackTestedOutUnits({ itemIds, userId: user.id });

    const before = await Promise.all([readLearnerRevision(user.id), readItemStatuses(itemIds)]);

    await finishLanguageLevelTest(goal.id);

    await expect(
      Promise.all([readLearnerRevision(user.id), readItemStatuses(itemIds)]),
    ).resolves.toStrictEqual(before);
  });

  it("places a result whose finish failed before placing it, once", async () => {
    const { goal, itemIds, user } = await placedLearnerFixture();
    mockSession(user.id);

    const placing = vi
      .spyOn(placement, "loadPlacement")
      .mockRejectedValueOnce(new Error("Plan busy"));

    try {
      await expect(finishLanguageLevelTest(goal.id)).rejects.toThrow("Plan busy");
    } finally {
      placing.mockRestore();
    }

    await expect(readItemStatuses(itemIds)).resolves.toStrictEqual([
      "todo",
      "todo",
      "todo",
      "todo",
    ]);

    await finishLanguageLevelTest(goal.id);

    await expect(readItemStatuses(itemIds)).resolves.toStrictEqual([
      "testedOut",
      "testedOut",
      "todo",
      "todo",
    ]);

    const revision = await readLearnerRevision(user.id);
    await finishLanguageLevelTest(goal.id);
    await expect(readLearnerRevision(user.id)).resolves.toBe(revision);
  });

  it("leaves the units the learner brought back to a finish that stalled before placing", async () => {
    const { goal, itemIds, user } = await placedLearnerFixture();
    mockSession(user.id);
    const pause = pauseNextFinishAfterSettling();

    try {
      const stalled = finishLanguageLevelTest(goal.id);
      await pause.settled;

      // Meanwhile a retry places the result, and the learner undoes its test-out.
      await finishLanguageLevelTest(goal.id);
      await bringBackTestedOutUnits({ itemIds, userId: user.id });
      const before = await Promise.all([readLearnerRevision(user.id), readItemStatuses(itemIds)]);

      pause.resume();
      await stalled;

      await expect(
        Promise.all([readLearnerRevision(user.id), readItemStatuses(itemIds)]),
      ).resolves.toStrictEqual(before);
    } finally {
      pause.resume();
    }
  });

  it("doesn't test a goal of another kind", async () => {
    const { user } = await languageGoalFixture();

    const other = await prisma.goal.create({
      data: {
        dailyMinutes: 20,
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
});

describe("level test on a non-Latin script", () => {
  it("saves the reading level with the result, which a repeat keeps and a new result starts over", async () => {
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

    // The alphabet follows the reading level, saved with the result in one plan-input change.
    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    // The answer, the test's result with its levels, then marking it placed.
    await expect(readLearnerRevision(user.id)).resolves.toBe(3n);

    const lessons = await prisma.languageSkillLevel.update({
      data: { windowCeiling: 1.5, windowCorrect: 2, windowTotal: 3 },
      where: { userLanguageSkill: { language: "ja", skill: "reading", userId: user.id } },
    });

    // Finishing the same test again keeps what lessons showed since.
    await finishLanguageLevelTest(goal.id);
    await expect(readLearnerRevision(user.id)).resolves.toBe(3n);
    await expect(readReading()).resolves.toStrictEqual(lessons);

    // A listening answer gives a new result, with the same reading level: reading starts over.
    await answerNextQuestion(goal.id);
    await finishLanguageLevelTest(goal.id);
    await expect(readLearnerRevision(user.id)).resolves.toBe(6n);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 2,
    });

    await expect(readReading()).resolves.toMatchObject({
      score: lessons.score,
      windowCeiling: null,
      windowCorrect: 0,
      windowTotal: 0,
    });
  });
});

/**
 * A learner tested right up to B2 (`TESTED_UP_TO_B2`) on the planner's plan, whose beginner skill
 * the result places past and whose intermediate one it doesn't. Monday, September 28, 2020.
 */
async function plannedLearnerFixture() {
  freezeClock();
  vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      skills: [
        { lessons: 2, level: "beginner" },
        { lessons: 2, level: "intermediate" },
      ],
    }),
    saveBank(),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    details: { level: "A2", levelTest: TESTED_UP_TO_B2 },
    kind: "language",
    language: "pt",
    settings: { startDate: "2020-09-28" },
    targetLanguage: "en",
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const [basics] = library.skills;

  /** What the result's placement shows: the beginner skill's lessons and memory, and the skips. */
  const readPlacement = async () => {
    const [items, skill, changes] = await Promise.all([
      prisma.planItem.findMany({
        orderBy: { position: "asc" },
        select: { status: true },
        where: { planId: plan.id, skillId: basics?.id },
      }),
      prisma.learnerSkill.findFirst({
        select: { reps: true },
        where: { skillId: basics?.id, userId: user.id },
      }),
      prisma.planChange.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true },
        where: { kind: "testedOut", planId: plan.id },
      }),
    ]);

    return { changes, items: items.map((item) => item.status), reps: skill?.reps ?? 0 };
  };

  const undo = (changeId: string) =>
    decidePlanChange({ changeId, goalId: goal.id, input: { status: "undone" } });

  return { goalId: goal.id, readPlacement, undo, userId: user.id };
}

/**
 * Holds the next `count` finishes once each has read what placement settles, until all of them
 * have, then until `release`, as slow requests would. Every write stays real.
 */
function holdPlacementReads(count = 1) {
  const load = placement.loadPlacement;
  const reached = Promise.withResolvers<null>();
  const released = Promise.withResolvers<null>();
  let waiting = 0;

  const reads = vi.spyOn(placement, "loadPlacement").mockImplementation(async (input) => {
    const loaded = await load(input);
    waiting += 1;

    if (waiting === count) {
      reads.mockRestore();
      reached.resolve(null);
    }

    await released.promise;
    return loaded;
  });

  const release = () => {
    released.resolve(null);
    reads.mockRestore();
  };

  return { reached: reached.promise, release };
}

/** Holds the next announcement of what placing a result skipped until `release`; it then runs. */
function holdNextAnnouncement() {
  const announce = announcement.announceTestedOutItems;
  const reached = Promise.withResolvers<null>();
  const released = Promise.withResolvers<null>();

  const held = vi
    .spyOn(announcement, "announceTestedOutItems")
    .mockImplementationOnce(async (input) => {
      reached.resolve(null);
      await released.promise;
      return announce(input);
    });

  const release = () => {
    released.resolve(null);
    held.mockRestore();
  };

  return { reached: reached.promise, release };
}

describe("placing a level test's result on the planner's plan", () => {
  it("skips the lessons below the level once, with one undo, when two finishes race", async () => {
    const { goalId, readPlacement, userId } = await plannedLearnerFixture();
    const reads = holdPlacementReads(2);

    try {
      // Both read what placement settles before either places it.
      const both = Promise.all([finishLanguageLevelTest(goalId), finishLanguageLevelTest(goalId)]);
      await reads.reached;
      reads.release();

      const [one, other] = await both;
      expect(one).toStrictEqual(other);
    } finally {
      reads.release();
    }

    const placed = await readPlacement();

    expect(placed).toMatchObject({
      changes: [{ status: "applied" }],
      items: ["testedOut", "testedOut"],
      reps: 1,
    });

    // Finishing again changes nothing.
    const revision = await readLearnerRevision(userId);
    await finishLanguageLevelTest(goalId);
    await expect(readPlacement()).resolves.toStrictEqual(placed);
    await expect(readLearnerRevision(userId)).resolves.toBe(revision);
  });

  // A finish that stalled went on after the learner undid the skip another finish announced: it
  // skipped the lessons again, with a second announcement.
  it("leaves the skip the learner undid to a finish that stalled before placing", async () => {
    const { goalId, readPlacement, undo, userId } = await plannedLearnerFixture();
    const reads = holdPlacementReads();

    try {
      const stalled = finishLanguageLevelTest(goalId);
      await reads.reached;

      await finishLanguageLevelTest(goalId);
      const placed = await readPlacement();
      const [skip] = placed.changes;
      await undo(skip?.id ?? "");

      const undone = await readPlacement();
      const revision = await readLearnerRevision(userId);
      expect(undone).toMatchObject({ items: ["todo", "todo"], reps: 0 });

      reads.release();
      await stalled;

      await expect(readPlacement()).resolves.toStrictEqual(undone);
      await expect(readLearnerRevision(userId)).resolves.toBe(revision);
    } finally {
      reads.release();
    }
  });

  it("leaves the skip the learner undid to a finish that stalled before announcing it", async () => {
    const { goalId, readPlacement, undo, userId } = await plannedLearnerFixture();
    const held = holdNextAnnouncement();

    try {
      const stalled = finishLanguageLevelTest(goalId);
      await held.reached;

      // A retry announces what the stalled finish placed, and the learner undoes it.
      await finishLanguageLevelTest(goalId);
      const placed = await readPlacement();
      const [skip] = placed.changes;
      await undo(skip?.id ?? "");

      const undone = await readPlacement();
      const revision = await readLearnerRevision(userId);

      held.release();
      await stalled;

      await expect(readPlacement()).resolves.toStrictEqual(undone);
      await expect(readLearnerRevision(userId)).resolves.toBe(revision);
    } finally {
      held.release();
    }
  });

  it("announces what a finish placed before it failed, once", async () => {
    const { goalId, readPlacement, userId } = await plannedLearnerFixture();

    const announcing = vi
      .spyOn(announcement, "announceTestedOutItems")
      .mockRejectedValueOnce(new Error("Plan busy"));

    try {
      await expect(finishLanguageLevelTest(goalId)).rejects.toThrow("Plan busy");
    } finally {
      announcing.mockRestore();
    }

    await expect(readPlacement()).resolves.toMatchObject({
      changes: [],
      items: ["testedOut", "testedOut"],
    });

    await finishLanguageLevelTest(goalId);
    const announced = await readPlacement();
    expect(announced.changes).toHaveLength(1);

    const revision = await readLearnerRevision(userId);
    await finishLanguageLevelTest(goalId);
    await expect(readPlacement()).resolves.toStrictEqual(announced);
    await expect(readLearnerRevision(userId)).resolves.toBe(revision);
  });
});
