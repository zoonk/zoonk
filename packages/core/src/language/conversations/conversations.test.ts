import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { createLiveConversationToken } from "@zoonk/ai/tasks/v2/language/live-conversation-token";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { loadSessionBoss } from "../../checkpoints/_utils/load-boss";
import { checkLanguageConversationObjectives } from "./check-language-conversation-objectives";
import { completeLanguageConversation } from "./complete-language-conversation";
import { connectLanguageConversation } from "./connect-language-conversation";
import { getLanguageConversation } from "./get-language-conversation";
import { startLanguageConversation } from "./start-language-conversation";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

// Scenarios, objective checks, feedback and Live tokens are paid model calls.
vi.mock("@zoonk/ai/tasks/v2/language/conversation-scenario", () => ({
  generateConversationScenario: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/conversation-objectives", () => ({
  checkConversationObjectives: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/conversation-feedback", () => ({
  writeConversationFeedback: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/live-conversation-token", () => ({
  createLiveConversationToken: vi.fn(),
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

const FEEDBACK = {
  encouragement: "Muito bem!",
  improve: {
    better: "Is it still available?",
    said: "It is available?",
    why: "Em perguntas, o verbo vem antes.",
  },
  pronunciation: [],
  wentWell: ["Can I see it on Saturday?"],
};

const TURNS = [
  { speaker: "character" as const, text: "Hi! Are you calling about the apartment?" },
  { speaker: "learner" as const, text: "It is available?" },
  { speaker: "learner" as const, text: "Can I see it on Saturday?" },
];

const COMPLETION = {
  spokenSeconds: 42,
  timeZone: "America/Sao_Paulo",
  turns: TURNS,
  usedHelp: false,
  voiceSeconds: 55,
};

const FREE_DAILY_CONVERSATIONS = 3;
const ELEVEN_MINUTES_MS = 660_000;
const TEN_MINUTES_MS = 600_000;

const CONNECTION = {
  expiresAt: 1_790_000_000,
  model: "openai/gpt-live-1",
  protocols: ["ai-gateway-realtime.v1", "ai-gateway-auth.vcst_test"],
  token: "vcst_test",
  url: "wss://ai-gateway.vercel.sh/v1/live/sessions",
};

/** The objective model's answer: these labels met, each with the learner's words. */
function objectivesAnswer(labels: string[]) {
  return {
    data: { met: labels.map((label) => ({ label, learnerWords: "It is available?" })) },
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  };
}

async function startPractice(chapterId: string) {
  const started = await startLanguageConversation({ chapterId, kind: "practice", minutes: 2 });

  if (started.status !== "ready") {
    throw new Error(`Couldn't start: ${started.status}`);
  }

  return started.conversationId;
}

/** A practice call the learner started and connected, as the app does before talking. */
async function connectPractice(chapterId: string) {
  const conversationId = await startPractice(chapterId);
  await connectLanguageConversation(conversationId);
  return conversationId;
}

describe("language conversations", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(createLiveConversationToken).mockResolvedValue(CONNECTION);

    vi.mocked(checkConversationObjectives).mockResolvedValue(
      objectivesAnswer(["Is it available?", "Book a viewing"]),
    );

    vi.mocked(writeConversationFeedback).mockResolvedValue({
      data: FEEDBACK,
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });
  });

  it("starts a unit's practice call from its cached scenario at the learner's level", async () => {
    const { goal, renting, user } = await languageGoalFixture();
    mockSession(user.id);

    const conversationId = await startPractice(renting.id);
    const result = await getLanguageConversation(conversationId);

    expect(generateConversationScenario).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      conversation: {
        character: RENTING_SCENARIO.character,
        goalId: goal.id,
        kind: "practice",
        level: "A2",
        minutes: 2,
        result: null,
        status: "ready",
        unit: { chapterId: renting.id },
      },
      status: "ready",
    });

    expect(result.status === "ready" && result.conversation.instructions).toBeTruthy();
  });

  it("keeps another learner's call hidden", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(getLanguageConversation(conversationId)).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(connectLanguageConversation(conversationId)).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("connects with a short-lived GPT-Live token and charges the call once", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    const first = await connectLanguageConversation(conversationId);
    const reconnect = await connectLanguageConversation(conversationId);

    expect(first).toStrictEqual({ setup: { ...CONNECTION, voice: "marin" }, status: "ready" });
    expect(reconnect).toStrictEqual(first);

    const [usage, row] = await Promise.all([
      prisma.usageRecord.count({ where: { kind: "conversation", userId: user.id } }),
      prisma.languageConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    ]);

    expect(usage).toBe(1);
    expect(row.startedAt).not.toBeNull();
  });

  it("ends a call's reconnects ten minutes after it connected", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    await prisma.usageRecord.updateMany({
      data: { createdAt: new Date(Date.now() - ELEVEN_MINUTES_MS) },
      where: { targetId: conversationId },
    });

    await expect(connectLanguageConversation(conversationId)).resolves.toStrictEqual({
      status: "conversationEnded",
    });
  });

  it("stops at the free plan's daily calls and never mints a token past it", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    await usageRecordsFixture({
      count: FREE_DAILY_CONVERSATIONS,
      kind: "conversation",
      userId: user.id,
    });

    await expect(connectLanguageConversation(conversationId)).resolves.toMatchObject({
      limit: { limit: FREE_DAILY_CONVERSATIONS, resource: "conversation" },
      status: "limitReached",
    });

    expect(createLiveConversationToken).not.toHaveBeenCalled();
  });

  it("gives guests no live calls", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);
    mockGuestSession(user.id);

    await expect(connectLanguageConversation(conversationId)).resolves.toMatchObject({
      status: "limitReached",
    });

    expect(createLiveConversationToken).not.toHaveBeenCalled();
  });

  it("marks the goals the learner's words achieved and keeps them for the call", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);
    const turns = TURNS.slice(0, 2);

    vi.mocked(checkConversationObjectives).mockResolvedValueOnce(
      objectivesAnswer(["Is it available?"]),
    );

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns } }),
    ).resolves.toStrictEqual({ objectivesMet: ["Is it available?"], status: "ready" });

    vi.mocked(checkConversationObjectives).mockResolvedValueOnce(
      objectivesAnswer(["Book a viewing"]),
    );

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } }),
    ).resolves.toStrictEqual({
      objectivesMet: ["Is it available?", "Book a viewing"],
      status: "ready",
    });

    // The second check only asked about the goals still open.
    expect(vi.mocked(checkConversationObjectives).mock.calls[1]?.[0]).toMatchObject({
      learnerLanguage: "pt",
      objectives: [{ label: "Book a viewing" }, { label: "Ask about the deposit" }],
      targetLanguage: "en",
      turns: TURNS,
    });

    await expect(getLanguageConversation(conversationId)).resolves.toMatchObject({
      conversation: { objectives: [{ met: true }, { met: true }, { met: false }] },
    });
  });

  it("keeps the goals already met when a check fails", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    await checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } });
    vi.mocked(checkConversationObjectives).mockRejectedValueOnce(new Error("model down"));

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } }),
    ).resolves.toStrictEqual({
      objectivesMet: ["Is it available?", "Book a viewing"],
      status: "ready",
    });
  });

  it("checks goals only for the learner's connected call while it runs", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const input = { turns: TURNS };
    const notConnected = await startPractice(renting.id);
    const connected = await connectPractice(renting.id);

    await expect(
      checkLanguageConversationObjectives({ conversationId: notConnected, input }),
    ).resolves.toStrictEqual({ status: "invalid" });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(
      checkLanguageConversationObjectives({ conversationId: connected, input }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(user.id);

    await prisma.languageConversation.update({
      data: { startedAt: new Date(Date.now() - TEN_MINUTES_MS) },
      where: { id: connected },
    });

    await expect(
      checkLanguageConversationObjectives({ conversationId: connected, input }),
    ).resolves.toStrictEqual({ status: "conversationEnded" });

    expect(checkConversationObjectives).not.toHaveBeenCalled();
  });

  it("slows a learner down under the AI rate limit before checking anything", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);
    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } }),
    ).resolves.toMatchObject({ status: "slowDown" });

    expect(vi.mocked(isRateLimited).mock.calls.at(-1)?.[0]).toMatchObject({
      key: `user:${user.id}`,
      rule: "ai-usage",
    });

    expect(checkConversationObjectives).not.toHaveBeenCalled();
  });

  it("finishes a call once with feedback, Brain Power, the ledger and speaking evidence", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    const first = await completeLanguageConversation({ conversationId, input: COMPLETION });
    const again = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(first).toMatchObject({
      conversation: {
        objectives: [{ met: true }, { met: true }, { met: false }],
        result: {
          brainPower: 20,
          feedback: { ...FEEDBACK, kind: "call" },
          spokenSeconds: 42,
          stars: 2,
        },
        status: "completed",
      },
      status: "completed",
    });

    expect(again).toStrictEqual(first);
    expect(writeConversationFeedback).toHaveBeenCalledOnce();

    const [events, speaking] = await Promise.all([
      prisma.learningEvent.findMany({ where: { kind: "conversation", userId: user.id } }),
      prisma.languageSkillLevel.findUnique({
        where: { userLanguageSkill: { language: "en", skill: "speaking", userId: user.id } },
      }),
    ]);

    expect(events).toHaveLength(1);

    expect(events[0]).toMatchObject({
      brainPower: 20,
      correctAnswers: 2,
      incorrectAnswers: 1,
      seconds: 42,
    });

    expect(speaking).toMatchObject({ windowCorrect: 2, windowTotal: 3 });
  });

  it("counts the goals marked during the call with the ones the full transcript shows", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    vi.mocked(checkConversationObjectives).mockResolvedValueOnce(
      objectivesAnswer(["Ask about the deposit"]),
    );

    await checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } });

    vi.mocked(checkConversationObjectives).mockResolvedValueOnce(
      objectivesAnswer(["Book a viewing"]),
    );

    const result = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(result).toMatchObject({
      conversation: { objectives: [{ met: false }, { met: true }, { met: true }] },
    });

    expect(writeConversationFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ objectivesMet: ["Book a viewing", "Ask about the deposit"] }),
    );
  });

  it("keeps the call when the feedback model fails", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);
    vi.mocked(writeConversationFeedback).mockRejectedValue(new Error("model down"));

    const result = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(result).toMatchObject({
      conversation: { result: { feedback: null }, status: "completed" },
    });
  });

  it("plays a language goal's checkpoint as the unit's call and closes it when won", async () => {
    const { goal, plan, user } = await languageGoalFixture();
    mockSession(user.id);

    const [boss, session] = await Promise.all([
      planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 0,
          phase: 1,
          rematch: false,
          timeLimitMinutes: null,
        },
        planItemId: boss.id,
      },
      sessionId: session.id,
    });

    const first = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });
    const again = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    expect(first.status).toBe("ready");
    expect(again).toStrictEqual(first);

    const conversationId = first.status === "ready" ? first.conversationId : "";

    vi.mocked(checkConversationObjectives).mockResolvedValue(
      objectivesAnswer(RENTING_SCENARIO.objectives.map((item) => item.label)),
    );

    const result = await completeLanguageConversation({ conversationId, input: COMPLETION });

    expect(result).toMatchObject({
      conversation: { kind: "checkpoint", minutes: 1, result: { passed: true, stars: 3 } },
    });

    const [savedBlock, item, event] = await Promise.all([
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
      prisma.learningEvent.findFirstOrThrow({ where: { kind: "checkpoint", userId: user.id } }),
    ]);

    expect(savedBlock.status).toBe("completed");
    expect(item.status).toBe("done");
    expect(event).toMatchObject({ correctAnswers: 3, lessonKind: "boss" });
  });

  it("schedules a language goal's reached boss as a call, with no questions to pick", async () => {
    const { items, plan, user } = await languageGoalFixture();

    await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } });
    const boss = await planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 });
    const planItems = await prisma.planItem.findMany({ where: { planId: plan.id } });

    const scheduled = await loadSessionBoss({
      examBlueprintId: null,
      goalKind: "language",
      items: planItems,
      skills: [],
      today: new Date(),
      userId: user.id,
    });

    expect(items).toHaveLength(4);

    expect(scheduled.checkpoint).toMatchObject({
      itemIds: [],
      kind: "finalBoss",
      planItemId: boss.id,
    });
  });

  it("says a checkpoint of another goal kind isn't a call", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const session = await studySessionFixture({ userId: user.id });
    const block = await studySessionBlockFixture({ kind: "checkpoint", sessionId: session.id });

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toStrictEqual({ status: "notLanguage" });
  });
});
