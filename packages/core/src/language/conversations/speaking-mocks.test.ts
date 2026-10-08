import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { scoreSpeakingMock } from "@zoonk/ai/tasks/v2/language/speaking-mock-score";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { completeLanguageConversation } from "./complete-language-conversation";
import { getLanguageConversation } from "./get-language-conversation";
import { prepareSpeakingMock } from "./prepare-language-calls";
import { startLanguageConversation } from "./start-language-conversation";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// The examiner's script and the scores are paid model calls.
vi.mock("@zoonk/ai/tasks/v2/language/conversation-scenario", () => ({
  generateConversationScenario: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/speaking-mock-score", () => ({ scoreSpeakingMock: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/language/conversation-objectives", () => ({
  checkConversationObjectives: vi.fn(),
}));

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6-luna",
  promptVersion: "v-test",
  provider: "openai",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-test",
  usage: {},
};

const GENERATED = { provenance: PROVENANCE, systemPrompt: "", usage: undefined as never };

const TOEFL_SCENARIO = {
  ...RENTING_SCENARIO,
  character: { name: "Sarah", place: "Test centre", role: "examinadora" },
  objectives: [
    { description: "Repita cada frase exatamente.", label: "Listen and Repeat" },
    { description: "Responda às quatro perguntas.", label: "Take an Interview" },
  ],
};

const TOEFL_SCORE = {
  criteria: [
    { bandHigh: 4.5, bandLow: 4, criterion: "repetition" as const, evidence: "e", tip: "t" },
    { bandHigh: 4, bandLow: 3.5, criterion: "elaboration" as const, evidence: "e", tip: "t" },
    { bandHigh: 4, bandLow: 3.5, criterion: "grammar" as const, evidence: "e", tip: "t" },
    { bandHigh: 4, bandLow: 3.5, criterion: "vocabulary" as const, evidence: "e", tip: "t" },
    { bandHigh: 4.5, bandLow: 3.5, criterion: "delivery" as const, evidence: "e", tip: "t" },
  ],
  exam: "toefl" as const,
  focus: "elaboration" as const,
  overall: { bandHigh: 4.5, bandLow: 4 },
};

const IELTS_SCORE = {
  criteria: (["fluencyCoherence", "lexicalResource", "grammar", "pronunciation"] as const).map(
    (criterion) => ({ bandHigh: 6.5, bandLow: 6, criterion, evidence: "e", tip: "t" }),
  ),
  exam: "ielts" as const,
  focus: "grammar" as const,
  overall: { bandHigh: 6.5, bandLow: 6 },
};

const TURNS = [
  { speaker: "character" as const, text: "Welcome to the science building." },
  { speaker: "learner" as const, text: "Welcome to the science building." },
  { speaker: "character" as const, text: "How do you usually study for exams?" },
  { speaker: "learner" as const, text: "I study with friends in the library." },
];

const COMPLETION = {
  spokenSeconds: 120,
  timeZone: "America/Sao_Paulo",
  turns: TURNS,
  usedHelp: false,
};

/** Marcos's English goal, preparing for the exam his reason names. */
async function examGoalFixture(reason: string) {
  const setup = await languageGoalFixture();

  await prisma.goal.update({
    data: { details: { level: "A2", reason, targetLevel: "B1+" } },
    where: { id: setup.goal.id },
  });

  mockSession(setup.user.id);
  return setup;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** A speaking mock the learner started and connected, which the call's end then scores. */
async function startMock(goalId: string) {
  const started = await startLanguageConversation({ goalId, kind: "speakingMock" });

  if (started.status !== "ready") {
    throw new Error(`Couldn't start: ${started.status}`);
  }

  // Connecting (which claims call time, tested with the calls) is when a call starts.
  await prisma.languageConversation.update({
    data: { startedAt: new Date() },
    where: { id: started.conversationId },
  });

  return started.conversationId;
}

describe("speaking mocks", () => {
  beforeEach(() => {
    vi.mocked(generateConversationScenario).mockResolvedValue({
      ...GENERATED,
      data: TOEFL_SCENARIO,
      userPrompt: "",
    });

    vi.mocked(checkConversationObjectives).mockResolvedValue({
      ...GENERATED,
      data: { met: [{ label: "Listen and Repeat", learnerWords: TURNS[1]?.text ?? "" }] },
      userPrompt: "",
    });
  });

  it("starts an IELTS mock with its own examiner and topic for a goal preparing for IELTS", async () => {
    const { goal } = await examGoalFixture("Vou fazer o IELTS em março");
    const view = await getLanguageConversation(await startMock(goal.id));

    expect(view).toMatchObject({
      conversation: { exam: "ielts", kind: "speakingMock", minutes: 5, unit: null },
      status: "ready",
    });

    expect(generateConversationScenario).toHaveBeenCalledWith(
      expect.objectContaining({ level: "A2", unitTitle: "IELTS Speaking test" }),
    );
  });

  it("starts a TOEFL mock with Listen and Repeat and the interview for a goal preparing for TOEFL", async () => {
    const { goal } = await examGoalFixture("Preciso do TOEFL para o mestrado");
    const view = await getLanguageConversation(await startMock(goal.id));

    expect(view).toMatchObject({
      conversation: {
        exam: "toefl",
        kind: "speakingMock",
        minutes: 5,
        objectives: [{ label: "Listen and Repeat" }, { label: "Take an Interview" }],
      },
      status: "ready",
    });

    expect(generateConversationScenario).toHaveBeenCalledWith(
      expect.objectContaining({ unitTitle: "TOEFL iBT Speaking section" }),
    );
  });

  it("keeps the mock for the exam goal a language goal moved to, and none for other exams", async () => {
    const { goal } = await languageGoalFixture();
    mockSession(goal.userId);

    const startFor = async (title: string) => {
      await prisma.goal.update({ data: { kind: "exam", title }, where: { id: goal.id } });
      const started = await startLanguageConversation({ goalId: goal.id, kind: "speakingMock" });

      if (started.status !== "ready") {
        return started.status;
      }

      const row = await prisma.languageConversation.findUniqueOrThrow({
        where: { id: started.conversationId },
      });

      return row.scenario;
    };

    await expect(startFor("IELTS")).resolves.toMatchObject({ exam: "ielts" });
    await expect(startFor("TOEFL")).resolves.toMatchObject({ exam: "toefl" });
    await expect(startFor("TOEFL ITP")).resolves.toBe("notLanguage");
    await expect(startFor("TOEIC")).resolves.toBe("notLanguage");
  });

  it("offers no mock to an English goal without IELTS or TOEFL, or to another language", async () => {
    const { goal } = await languageGoalFixture();
    mockSession(goal.userId);

    await expect(
      startLanguageConversation({ goalId: goal.id, kind: "speakingMock" }),
    ).resolves.toStrictEqual({ status: "notLanguage" });

    const spanish = await examGoalFixture("Vou fazer o TOEFL");
    await prisma.goal.update({ data: { targetLanguage: "es" }, where: { id: spanish.goal.id } });

    await expect(
      startLanguageConversation({ goalId: spanish.goal.id, kind: "speakingMock" }),
    ).resolves.toStrictEqual({ status: "notLanguage" });

    expect(generateConversationScenario).not.toHaveBeenCalled();
  });

  it("scores a TOEFL mock by TOEFL criteria and stores its feedback once", async () => {
    const { goal, user } = await examGoalFixture("Preciso do TOEFL para o mestrado");
    const conversationId = await startMock(goal.id);

    vi.mocked(scoreSpeakingMock).mockResolvedValue({
      ...GENERATED,
      data: TOEFL_SCORE,
      userPrompt: "",
    });

    const first = await completeLanguageConversation({ conversationId, input: COMPLETION });
    const again = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(scoreSpeakingMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ exam: "toefl", learnerLanguage: "pt", turns: TURNS }),
    );

    expect(first).toMatchObject({
      conversation: {
        exam: "toefl",
        result: { feedback: { ...TOEFL_SCORE, kind: "speakingMock" }, spokenSeconds: 120 },
        status: "completed",
      },
      status: "completed",
    });

    expect(again).toStrictEqual(first);

    await expect(
      prisma.learningEvent.findFirstOrThrow({ where: { kind: "mock", userId: user.id } }),
    ).resolves.toMatchObject({ lessonKind: "speakingMock" });
  });

  it("keeps IELTS feedback on the IELTS scale", async () => {
    const { goal } = await examGoalFixture("Vou fazer o IELTS");
    const conversationId = await startMock(goal.id);

    const ieltsScore = {
      criteria: (["fluencyCoherence", "lexicalResource", "grammar", "pronunciation"] as const).map(
        (criterion) => ({ bandHigh: 6.5, bandLow: 6, criterion, evidence: "e", tip: "t" }),
      ),
      exam: "ielts" as const,
      focus: "grammar" as const,
      overall: { bandHigh: 6.5, bandLow: 6 },
    };

    vi.mocked(scoreSpeakingMock).mockResolvedValue({
      ...GENERATED,
      data: ieltsScore,
      userPrompt: "",
    });

    const result = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(scoreSpeakingMock).toHaveBeenCalledWith(expect.objectContaining({ exam: "ielts" }));

    expect(result).toMatchObject({
      conversation: {
        exam: "ielts",
        result: { feedback: { ...ieltsScore, kind: "speakingMock" } },
      },
    });
  });

  it("scores a mock while the transcript's goals are checked", async () => {
    const { goal } = await examGoalFixture("Vou fazer o IELTS");
    const conversationId = await startMock(goal.id);
    const order: string[] = [];
    const scoring = Promise.withResolvers<null>();

    vi.mocked(scoreSpeakingMock).mockImplementation(async () => {
      order.push("score started");
      scoring.resolve(null);
      return { ...GENERATED, data: IELTS_SCORE, userPrompt: "" };
    });

    // The check waits for the score to start, or gives up when the score only starts after it.
    vi.mocked(checkConversationObjectives).mockImplementation(async () => {
      await Promise.race([scoring.promise, sleep(300)]);
      order.push("goals checked");
      return { ...GENERATED, data: { met: [] }, userPrompt: "" };
    });

    const result = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(order).toStrictEqual(["score started", "goals checked"]);

    expect(result).toMatchObject({
      conversation: { result: { feedback: { ...IELTS_SCORE, kind: "speakingMock" } } },
    });
  });

  it("starts the mock written ahead instead of writing one while the learner waits", async () => {
    const { goal, user } = await examGoalFixture("Vou fazer o IELTS em março");

    await prepareSpeakingMock({ goalId: goal.id, userId: user.id });
    await prepareSpeakingMock({ goalId: goal.id, userId: user.id });

    const waiting = await prisma.languageConversation.findMany({ where: { goalId: goal.id } });

    expect(waiting).toMatchObject([
      { kind: "speakingMock", level: "A2", startedAt: null, status: "ready" },
    ]);

    expect(generateConversationScenario).toHaveBeenCalledOnce();

    await expect(startMock(goal.id)).resolves.toBe(waiting[0]?.id);
    expect(generateConversationScenario).toHaveBeenCalledOnce();
  });

  it("writes no next mock for one that never connected, so ending unstarted mocks can't write mocks", async () => {
    const waitForDeferredWork = runDeferredWork();
    const { goal } = await examGoalFixture("Preciso do TOEFL para o mestrado");
    const started = await startLanguageConversation({ goalId: goal.id, kind: "speakingMock" });
    const conversationId = started.status === "ready" ? started.conversationId : "";

    await completeLanguageConversation({ conversationId, input: COMPLETION });
    await waitForDeferredWork();

    expect(scoreSpeakingMock).not.toHaveBeenCalled();
    expect(generateConversationScenario).toHaveBeenCalledOnce();
  });

  it("writes the next mock ahead once a mock ends, so another try starts at once", async () => {
    const waitForDeferredWork = runDeferredWork();
    const { goal } = await examGoalFixture("Preciso do TOEFL para o mestrado");
    const first = await startMock(goal.id);

    vi.mocked(scoreSpeakingMock).mockResolvedValue({
      ...GENERATED,
      data: TOEFL_SCORE,
      userPrompt: "",
    });

    await completeLanguageConversation({ conversationId: first, input: COMPLETION });
    await waitForDeferredWork();

    expect(generateConversationScenario).toHaveBeenCalledTimes(2);

    const next = await startMock(goal.id);

    expect(next).not.toBe(first);
    expect(generateConversationScenario).toHaveBeenCalledTimes(2);

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: next } }),
    ).resolves.toMatchObject({ scenario: { exam: "toefl" }, status: "ready" });
  });

  it("writes a new mock when the waiting one was opened or is for another level", async () => {
    const { goal, user } = await examGoalFixture("Vou fazer o IELTS");
    await prepareSpeakingMock({ goalId: goal.id, userId: user.id });

    const opened = await prisma.languageConversation.findFirstOrThrow({
      where: { goalId: goal.id },
    });

    await prisma.languageConversation.update({
      data: { startedAt: new Date() },
      where: { id: opened.id },
    });

    await prepareSpeakingMock({ goalId: goal.id, userId: user.id });

    // The learner's speaking moved up to B1: the A2 mock waiting for them no longer fits.
    await prisma.languageSkillLevel.create({
      data: { language: "en", score: 2, skill: "speaking", startScore: 1, userId: user.id },
    });

    const started = await startMock(goal.id);
    const mocks = await prisma.languageConversation.findMany({ where: { goalId: goal.id } });

    expect(mocks).toHaveLength(3);
    expect(mocks.find((mock) => mock.id === started)).toMatchObject({ level: "B1" });

    expect(generateConversationScenario).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: "B1" }),
    );
  });

  it("writes no mock ahead for a goal without IELTS or TOEFL", async () => {
    const { goal, user } = await languageGoalFixture();

    await prepareSpeakingMock({ goalId: goal.id, userId: user.id });

    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(prisma.languageConversation.count({ where: { goalId: goal.id } })).resolves.toBe(
      0,
    );
  });
});
