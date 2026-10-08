import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { generateLevelTestBank } from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getUsageRule } from "../../entitlements/limits";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { gradeLevelTestSpeech } from "./grade-level-test-speech";
import { type LevelTestBank } from "./level-test-contract";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// Writing the bank and checking speech are paid model calls.
vi.mock("@zoonk/ai/tasks/v2/language/level-test-bank", () => ({ generateLevelTestBank: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/language/assess-pronunciation", () => ({
  assessPronunciation: vi.fn(),
}));

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

async function saveBank() {
  await prisma.languageLevelTest.upsert({
    create: {
      content: BANK,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content: BANK },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });
}

describe("language level test", () => {
  beforeEach(async () => {
    await prisma.languageLevelTest.deleteMany({ where: { language: "pt", targetLanguage: "en" } });
  });

  it("says nothing is writing the pair's questions yet, without writing them itself", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const result = await getLanguageLevelTest(goal.id);

    expect(result).toStrictEqual({
      status: "ready",
      test: { expectedSeconds: 120, startedAt: null, status: "preparing" },
    });

    expect(generateLevelTestBank).not.toHaveBeenCalled();
  });

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

    const answered = await answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, questionId: "reading-A2-0" },
    });

    expect(answered).toMatchObject({ status: "ready", test: { answered: 1, lastCorrect: true } });

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
