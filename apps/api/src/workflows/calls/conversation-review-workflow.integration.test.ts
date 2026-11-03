import { conversationReviewRuns } from "@/lib/conversation-review-runs";
import { writeConversationFeedback } from "@zoonk/ai/tasks/language/conversation-feedback";
import { checkConversationObjectives } from "@zoonk/ai/tasks/language/conversation-objectives";
import { generateSpeakingMockScenario } from "@zoonk/ai/tasks/language/speaking-mock-scenario";
import { scoreSpeaking } from "@zoonk/ai/tasks/language/speaking-score";
import { extractMemoryFacts } from "@zoonk/ai/tasks/memory/extraction";
import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { completeLanguageConversation } from "@zoonk/core/language/conversations/complete";
import { prepareSpeakingMock } from "@zoonk/core/language/conversations/prepare";
import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { BLOCKED_TEST_CALL } from "@zoonk/utils/blocked-test-call";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { conversationReviewWorkflow } from "./conversation-review-workflow";

vi.mock("@zoonk/ai/tasks/language/live-call-session", () => ({
  createLiveCallSession: vi.fn(),
  hangUpLiveCallSession: vi.fn(),
  isLiveCallAvailable: vi.fn(() => true),
}));

vi.mock("@zoonk/ai/tasks/language/conversation-feedback", () => ({
  writeConversationFeedback: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/language/conversation-objectives", () => ({
  checkConversationObjectives: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/language/speaking-mock-scenario", () => ({
  generateSpeakingMockScenario: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/memory/gate", () => ({ gateMemoryFact: vi.fn() }));
vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
vi.mock("@zoonk/ai/tasks/language/speaking-score", () => ({ scoreSpeaking: vi.fn() }));

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

const FEEDBACK = {
  encouragement: "Muito bem!",
  improve: { better: "Is it still available?", said: "It is available?", why: "Ordem." },
  pronunciation: [],
  wentWell: ["It is available?"],
};

const TURNS = [
  { speaker: "character" as const, text: "Hi! Are you calling about the apartment?" },
  { speaker: "learner" as const, text: "It is available?" },
];

const MOVING_FACT = {
  category: "context" as const,
  evidence: "I move to Toronto next month",
  expiresOn: null,
  intent: "remember" as const,
  origin: "said" as const,
  statement: "Está se mudando para Toronto",
};

function modelAnswer<T>(data: T) {
  return {
    data,
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  };
}

/** Calls settled by earlier tests may still be read while this one runs. */
function extractionsFor(userId: string) {
  return vi
    .mocked(extractMemoryFacts)
    .mock.calls.filter(([params]) => params.analytics?.distinctId === userId);
}

async function liveCall() {
  const user = await userFixture();
  const startedAt = new Date();

  const conversation = await prisma.languageConversation.create({
    data: {
      kind: "practice",
      language: "pt",
      level: "A2",
      minutes: 2,
      scenario: RENTING_SCENARIO,
      startedAt,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: user.id,
    },
  });

  const connection = await prisma.liveCallConnection.create({
    data: {
      conversationId: conversation.id,
      costMicros: 122_500,
      deadlineAt: new Date(startedAt.getTime() + 120_000),
      heldSeconds: 120,
      providerSessionId: `live_${crypto.randomUUID()}`,
      startedAt,
      state: "live",
      userId: user.id,
    },
  });

  return { connectionId: connection.id, conversationId: conversation.id, userId: user.id };
}

describe(conversationReviewWorkflow, () => {
  beforeEach(() => {
    vi.mocked(writeConversationFeedback).mockReset().mockResolvedValue(modelAnswer(FEEDBACK));

    vi.mocked(extractMemoryFacts)
      .mockReset()
      .mockResolvedValue(modelAnswer({ facts: [] }));

    vi.mocked(gateMemoryFact)
      .mockReset()
      .mockResolvedValue({ decision: "keep", sensitive: false } as Awaited<
        ReturnType<typeof gateMemoryFact>
      >);

    vi.mocked(checkConversationObjectives)
      .mockReset()
      .mockResolvedValue(
        modelAnswer({
          goodbye: false,
          met: [{ label: "Is it available?", learnerWords: "It is available?" }],
        }),
      );
  });

  it("[3] retries a review that failed once and settles the call once", async () => {
    const call = await liveCall();
    vi.mocked(writeConversationFeedback).mockRejectedValueOnce(new Error("The model is busy"));

    const run = await start(conversationReviewWorkflow, [
      { ...call, spokenSeconds: 20, timeZone: "UTC", turns: TURNS, usedHelp: false },
    ]);

    await expect(run.returnValue).resolves.toMatchObject({ status: "completed" });
    expect(writeConversationFeedback).toHaveBeenCalledTimes(2);
    expect(checkConversationObjectives).toHaveBeenCalledOnce();

    const [conversation, events, connection] = await Promise.all([
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.conversationId } }),
      prisma.learningEvent.count({ where: { userId: call.userId } }),
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: call.connectionId } }),
    ]);

    expect(conversation).toMatchObject({
      feedback: FEEDBACK,
      reviewRunId: run.runId,
      status: "completed",
    });

    expect(events).toBe(1);
    expect(connection).toMatchObject({ endReason: "completion", state: "ended" });
  });

  it("[3] settles a call whose review the test kill switch stopped at once, without feedback", async () => {
    const call = await liveCall();
    vi.mocked(writeConversationFeedback).mockRejectedValue(new Error(BLOCKED_TEST_CALL));

    const run = await start(conversationReviewWorkflow, [
      { ...call, spokenSeconds: 20, timeZone: "UTC", turns: TURNS, usedHelp: false },
    ]);

    await expect(run.returnValue).resolves.toMatchObject({ status: "completed" });
    expect(writeConversationFeedback).toHaveBeenCalledOnce();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.conversationId } }),
    ).resolves.toMatchObject({ feedback: null, status: "completed" });
  });

  it("[3] gives two completions at once one review and one settlement", async () => {
    const call = await liveCall();

    vi.mocked(getSession).mockResolvedValue(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Completion reads only the learner's id.
      { user: { id: call.userId } } as Awaited<ReturnType<typeof getSession>>,
    );

    const completion = () =>
      completeLanguageConversation({
        conversationId: call.conversationId,
        input: {
          connectionId: call.connectionId,
          spokenSeconds: 20,
          timeZone: "UTC",
          turns: TURNS,
          usedHelp: false,
        },
        runs: conversationReviewRuns,
      });

    const results = await Promise.all([completion(), completion()]);

    expect(results.map((result) => result.status)).toStrictEqual(["completed", "completed"]);
    expect(writeConversationFeedback).toHaveBeenCalledOnce();

    await expect(prisma.learningEvent.count({ where: { userId: call.userId } })).resolves.toBe(1);
  });

  it("remembers what the learner said about their life once the call settles, and only then", async () => {
    const call = await liveCall();
    vi.mocked(extractMemoryFacts).mockResolvedValue(modelAnswer({ facts: [MOVING_FACT] }));

    const completion = {
      ...call,
      spokenSeconds: 20,
      timeZone: "UTC",
      turns: [...TURNS, { speaker: "learner" as const, text: "I move to Toronto next month." }],
      usedHelp: false,
    };

    const run = await start(conversationReviewWorkflow, [completion]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "completed" });

    await vi.waitFor(
      async () => {
        await expect(
          prisma.memoryFact.findMany({
            select: { sourceRef: true, statement: true },
            where: { userId: call.userId },
          }),
        ).resolves.toStrictEqual([
          {
            sourceRef: { id: call.conversationId, kind: "call" },
            statement: MOVING_FACT.statement,
          },
        ]);
      },
      { interval: 200, timeout: 30_000 },
    );

    expect(extractionsFor(call.userId)).toStrictEqual([
      [expect.objectContaining({ source: "call", turns: completion.turns })],
    ]);

    expect(gateMemoryFact).toHaveBeenCalledWith({
      candidate: expect.objectContaining({ statement: MOVING_FACT.statement }),
    });

    const replay = await start(conversationReviewWorkflow, [completion]);
    await expect(replay.returnValue).resolves.toMatchObject({ status: "completed" });

    expect(extractionsFor(call.userId)).toHaveLength(1);
  });

  it("[3] writes the next speaking mock once it settles one the learner connected to", async () => {
    const { goal, user } = await languageGoalFixture();

    await Promise.all([
      prisma.goal.update({
        data: { details: { level: "A2", reason: "Preciso do TOEFL", targetLevel: "B1+" } },
        where: { id: goal.id },
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    vi.mocked(generateSpeakingMockScenario).mockResolvedValue(modelAnswer(RENTING_SCENARIO));
    vi.mocked(scoreSpeaking).mockRejectedValue(new Error(BLOCKED_TEST_CALL));

    await prepareSpeakingMock({ goalId: goal.id, userId: user.id });

    const mock = await prisma.languageConversation.findFirstOrThrow({
      where: { goalId: goal.id, kind: "speakingMock" },
    });

    const startedAt = new Date();

    const [, connection] = await Promise.all([
      prisma.languageConversation.update({ data: { startedAt }, where: { id: mock.id } }),
      prisma.liveCallConnection.create({
        data: {
          conversationId: mock.id,
          costMicros: 122_500,
          deadlineAt: new Date(startedAt.getTime() + 120_000),
          heldSeconds: 120,
          providerSessionId: `live_${crypto.randomUUID()}`,
          startedAt,
          state: "live",
          userId: user.id,
        },
      }),
    ]);

    const run = await start(conversationReviewWorkflow, [
      {
        connectionId: connection.id,
        conversationId: mock.id,
        spokenSeconds: 20,
        timeZone: "UTC",
        turns: TURNS,
        usedHelp: false,
        userId: user.id,
      },
    ]);

    await expect(run.returnValue).resolves.toMatchObject({ status: "completed" });

    await vi.waitFor(
      async () => {
        await expect(
          prisma.languageConversation.findMany({
            select: { startedAt: true, status: true },
            where: { goalId: goal.id, id: { not: mock.id }, kind: "speakingMock" },
          }),
        ).resolves.toStrictEqual([{ startedAt: null, status: "ready" }]);
      },
      { interval: 200, timeout: 10_000 },
    );
  });
});
