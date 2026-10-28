import { conversationReviewRuns } from "@/lib/conversation-review-runs";
import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { completeLanguageConversation } from "@zoonk/core/language/conversations/complete";
import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { BLOCKED_TEST_CALL } from "@zoonk/utils/blocked-test-call";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { conversationReviewWorkflow } from "./conversation-review-workflow";

/** Only the provider and the review models are replaced; the steps run real core and PostgreSQL. */
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  createLiveCallSession: vi.fn(),
  hangUpLiveCallSession: vi.fn(),
  isLiveCallAvailable: vi.fn(() => true),
}));

vi.mock("@zoonk/ai/tasks/v2/language/conversation-feedback", () => ({
  writeConversationFeedback: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/conversation-objectives", () => ({
  checkConversationObjectives: vi.fn(),
}));

/** The signed-in learner of the completion request. */
vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

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

function modelAnswer<T>(data: T) {
  return {
    data,
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  };
}

/** A learner's practice call that connected and is still live. */
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

    vi.mocked(checkConversationObjectives)
      .mockReset()
      .mockResolvedValue(
        modelAnswer({ met: [{ label: "Is it available?", learnerWords: "It is available?" }] }),
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
});
