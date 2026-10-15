import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
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

  it("marks a repeated finish when the pre-existing scoring behavior changes its values", async () => {
    await saveBank();
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, durationMs: 40_000, questionId: "reading-A2-0" },
    });

    const before = await readLearnerRevision(user.id);
    const first = await finishLanguageLevelTest(goal.id);
    expect.soft(await readLearnerRevision(user.id)).toBe(before + 2n);
    const retry = await finishLanguageLevelTest(goal.id);
    /** Pre-existing bug: finishing changes details.level, which becomes the next finish's scoring prior. */
    expect(retry).not.toStrictEqual(first);
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 4n);

    await expect(
      prisma.learningEvent.count({ where: { goalId: goal.id, lessonKind: "levelTest" } }),
    ).resolves.toBe(1);
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
    await saveBank();
    const { goal, items, lessons, user } = await languageGoalFixture();
    mockSession(user.id);

    const [basics, onLevel] = await Promise.all([
      skillFixture({ language: "pt", level: "beginner", name: "Chegar ao aeroporto" }),
      skillFixture({ language: "pt", level: "intermediate", name: "Negociar o aluguel" }),
    ]);

    // Right up to B2 in reading and listening: B1 or above, past the A1–A2 band.
    const answers = ["reading", "listening"].flatMap((skill) =>
      ["A2", "B1", "B2"].map((level) => `${skill}-${level}-0`),
    );

    await Promise.all([
      ...lessons.map((lesson, index) =>
        lessonSkillFixture({ lessonId: lesson.id, skillId: (index < 2 ? basics : onLevel).id }),
      ),
      prisma.goal.update({
        data: {
          details: {
            ...(goal.details as object),
            levelTest: { answers: answers.map((id) => ({ answerIndex: 1, id })), speaking: null },
          },
        },
        where: { id: goal.id },
      }),
    ]);

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });

    const statuses = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: { status: true },
      where: { id: { in: items.map((item) => item.id) } },
    });

    expect(statuses.map((item) => item.status)).toStrictEqual([
      "testedOut",
      "testedOut",
      "todo",
      "todo",
    ]);
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

describe("level-test skill selection admission", () => {
  it("marks the second transaction's reading score but keeps an equal-score window reset revision-only", async () => {
    await saveBank("ja");
    const { goal, user, plan } = await languageGoalFixture();
    await prisma.goal.update({ data: { targetLanguage: "ja" }, where: { id: goal.id } });
    mockSession(user.id);
    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 2,
    });

    await expect(readLearnerRevision(user.id)).resolves.toBe(2n);
    await finishLanguageLevelTest(goal.id);
    await expect(readLearnerRevision(user.id)).resolves.toBe(2n);

    await prisma.languageSkillLevel.update({
      data: { windowCeiling: 1.5, windowCorrect: 2, windowTotal: 3 },
      where: { userLanguageSkill: { language: "ja", skill: "reading", userId: user.id } },
    });

    await finishLanguageLevelTest(goal.id);
    await expect(readLearnerRevision(user.id)).resolves.toBe(3n);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 2,
    });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({
        where: { userLanguageSkill: { language: "ja", skill: "reading", userId: user.id } },
      }),
    ).resolves.toMatchObject({ score: 1, windowCeiling: null, windowCorrect: 0, windowTotal: 0 });
  });
});
