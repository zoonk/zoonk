import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import {
  closeLiveCallSession,
  createLiveCallSession,
} from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTestCalls,
  connectTestCall,
  reserveTestCall,
  setupTestCalls,
  testCallCompletionInput,
} from "../../_test-utils/connect-test-call";
import { freezeClock } from "../../_test-utils/frozen-clock";
import {
  holdLearnerRevision,
  readLearnerRevision,
  waitForBlockedStatement,
} from "../../_test-utils/learner-revision";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { loadSessionBosses } from "../../checkpoints/_utils/load-boss";
import { checkLanguageConversationObjectives } from "./check-language-conversation-objectives";
import { completeLanguageConversation } from "./complete-language-conversation";
import { getLanguageConversation } from "./get-language-conversation";
import { redeemLiveCallSdp } from "./redeem-live-call-sdp";
import { startLanguageConversation } from "./start-language-conversation";

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

/** The free plan's call time a day, in seconds. */
const FREE_CALL_SECONDS = 120;
const PRACTICE_SECONDS = 120;
const TEN_MINUTES_MS = 600_000;
const DAY_MS = 86_400_000;

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
  await connectTestCall(conversationId);
  return conversationId;
}

describe("language conversations", () => {
  beforeEach(async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    await setupTestCalls();

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

  afterEach(cleanupTestCalls);

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

    await expect(reserveTestCall(conversationId)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("reserves a durable deadline without provider spend, then creates the server-owned session", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    const reserved = await reserveTestCall(conversationId);

    expect(reserved).toMatchObject({
      setup: {
        connectionId: expect.any(String),
        deadlineAt: expect.any(String),
        endsAtLimit: null,
        generation: 1,
        seconds: PRACTICE_SECONDS,
        voice: "marin",
      },
      status: "ready",
    });

    expect(createLiveCallSession).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    ).resolves.toMatchObject({ startedAt: null });

    if (reserved.status !== "ready") {
      throw new Error("Expected reservation");
    }

    expect(reserved.setup.sessionUrl).toBe(
      `/v1/language-conversations/${conversationId}/connections/${reserved.setup.connectionId}/sdp`,
    );

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: reserved.setup.connectionId } }),
    ).resolves.toMatchObject({
      providerSessionId: null,
      state: "pending",
      workflowRunId: `test-deadline-${reserved.setup.connectionId}`,
    });

    await expect(
      redeemLiveCallSdp({
        connectionId: reserved.setup.connectionId,
        conversationId,
        input: { sdp: "test-offer", sessionConfig: { instructions: "untrusted" } },
      }),
    ).resolves.toMatchObject({
      sdp: "test-answer",
      sessionId: expect.any(String),
      status: "ready",
    });

    expect(createLiveCallSession).toHaveBeenCalledExactlyOnceWith({
      instructions: expect.stringContaining(RENTING_SCENARIO.character.name),
      sdp: "test-offer",
      voice: "marin",
    });

    const [usage, row] = await Promise.all([
      prisma.usageRecord.findMany({ where: { kind: "conversation", userId: user.id } }),
      prisma.languageConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    ]);

    expect(usage).toMatchObject([{ seconds: PRACTICE_SECONDS, targetId: conversationId }]);
    expect(row.startedAt).not.toBeNull();
  });

  it("starts a dropped call over when it connects again, keeping what the dropped one ran", async () => {
    freezeClock();

    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    // A one-minute call, so what's left of the day's call time holds it again.
    const started = await startLanguageConversation({
      chapterId: renting.id,
      kind: "practice",
      minutes: 1,
    });

    const conversationId = started.status === "ready" ? started.conversationId : "";
    await connectTestCall(conversationId);

    // The provider confirms the first connection ran for half a minute before reconnecting.
    vi.setSystemTime(new Date(Date.now() + 30_000));

    await expect(reserveTestCall(conversationId)).resolves.toMatchObject({
      setup: { endsAtLimit: null, seconds: 60 },
      status: "ready",
    });

    const record = await prisma.usageRecord.findFirstOrThrow({
      where: { targetId: conversationId },
    });

    expect(record.seconds).toBeGreaterThanOrEqual(90);
    expect(record.seconds).toBeLessThanOrEqual(92);
  });

  it("can't connect again a call claimed on an earlier day", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    await prisma.usageRecord.updateMany({
      data: { createdAt: new Date(Date.now() - DAY_MS) },
      where: { targetId: conversationId },
    });

    await expect(reserveTestCall(conversationId)).resolves.toStrictEqual({
      status: "conversationEnded",
    });
  });

  it("ends a call early at the day's call time, and says so", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    await usageRecordsFixture({
      count: 1,
      kind: "conversation",
      seconds: FREE_CALL_SECONDS - 90,
      userId: user.id,
    });

    await expect(reserveTestCall(conversationId)).resolves.toMatchObject({
      setup: { endsAtLimit: "day", seconds: 90 },
      status: "ready",
    });
  });

  it("stops at the free plan's daily call time without creating a provider session", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    await usageRecordsFixture({
      count: 1,
      kind: "conversation",
      seconds: FREE_CALL_SECONDS - 30,
      userId: user.id,
    });

    await expect(reserveTestCall(conversationId)).resolves.toMatchObject({
      limit: { limit: FREE_CALL_SECONDS, resource: "callSeconds" },
      status: "limitReached",
    });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("keeps only what a finished call ran in the day's call time", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    vi.mocked(closeLiveCallSession).mockResolvedValueOnce({
      reason: "close_requested",
      seconds: 45,
      status: "closed",
    });

    await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
    });

    const record = await prisma.usageRecord.findFirstOrThrow({
      where: { targetId: conversationId },
    });

    expect(record.seconds).toBeGreaterThanOrEqual(45);
    expect(record.seconds).toBeLessThanOrEqual(47);
    expect(record.costMicros).toBe(10_000 + Math.round((record.seconds * 50_000) / 60));

    await expect(
      prisma.liveCallConnection.findMany({ where: { conversationId } }),
    ).resolves.toMatchObject([
      { costConfidence: "confirmed", settledMicros: record.costMicros, state: "closed" },
    ]);

    const [closedAt] = vi.mocked(closeLiveCallSession).mock.invocationCallOrder;
    const [reviewedAt] = vi.mocked(writeConversationFeedback).mock.invocationCallOrder;
    expect(closedAt).toBeLessThan(reviewedAt ?? 0);
  });

  it("gives guests no live calls", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);
    mockGuestSession(user.id);

    await expect(reserveTestCall(conversationId)).resolves.toMatchObject({
      status: "limitReached",
    });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("marks the goals the learner's words achieved and keeps them for the call", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);
    const turns = TURNS.slice(0, 2);
    const before = await readLearnerRevision(user.id);

    vi.mocked(checkConversationObjectives).mockResolvedValueOnce(
      objectivesAnswer(["Is it available?"]),
    );

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns } }),
    ).resolves.toStrictEqual({ objectivesMet: ["Is it available?"], status: "ready" });

    // The call screen shows each goal met as it's met: one change per check that met one.
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 1n);

    vi.mocked(checkConversationObjectives).mockResolvedValueOnce(
      objectivesAnswer(["Book a viewing"]),
    );

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } }),
    ).resolves.toStrictEqual({
      objectivesMet: ["Is it available?", "Book a viewing"],
      status: "ready",
    });

    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);

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

  it("marks a goal two overlapping checks both found only once", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    const check = () =>
      checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } });

    vi.mocked(checkConversationObjectives).mockResolvedValue(
      objectivesAnswer(["Is it available?"]),
    );

    const writer = holdLearnerRevision({ userId: user.id });
    const pid = await writer.pid;
    const before = await readLearnerRevision(user.id);
    const both = Promise.all([check(), check()]);
    await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    writer.release();
    await writer.done;

    await expect(both).resolves.toStrictEqual([
      { objectivesMet: ["Is it available?"], status: "ready" },
      { objectivesMet: ["Is it available?"], status: "ready" },
    ]);

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    ).resolves.toMatchObject({ objectivesMet: ["Is it available?"] });

    // The held writer's change and the goal met once.
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
  });

  it("keeps the goals already met when a check fails", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    await checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } });
    vi.mocked(checkConversationObjectives).mockRejectedValueOnce(new Error("model down"));
    const before = await readLearnerRevision(user.id);

    await expect(
      checkLanguageConversationObjectives({ conversationId, input: { turns: TURNS } }),
    ).resolves.toStrictEqual({
      objectivesMet: ["Is it available?", "Book a viewing"],
      status: "ready",
    });

    // A check that met nothing new changes nothing.
    await expect(readLearnerRevision(user.id)).resolves.toBe(before);
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

  it("reviews nothing for a call that never connected, whatever turns it's sent: only connecting claims call time", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await startPractice(renting.id);

    await reserveTestCall(conversationId);

    await expect(
      completeLanguageConversation({
        conversationId,
        input: testCallCompletionInput(conversationId, COMPLETION),
      }),
    ).resolves.toMatchObject({
      conversation: { result: { brainPower: 0, feedback: null, spokenSeconds: 0 } },
      status: "completed",
    });

    expect(writeConversationFeedback).not.toHaveBeenCalled();
    expect(checkConversationObjectives).not.toHaveBeenCalled();
  });

  it("finishes a call once with feedback, Brain Power, the ledger and speaking evidence", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const conversationId = await connectPractice(renting.id);

    const first = await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
    });

    const again = await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
    });

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

    const result = await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
    });

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
    const conversationId = await connectPractice(renting.id);
    vi.mocked(writeConversationFeedback).mockRejectedValue(new Error("model down"));

    const result = await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
    });

    expect(result).toMatchObject({
      conversation: { result: { feedback: null }, status: "completed" },
    });
  });

  it("plays a language goal's checkpoint as the unit's call and closes it when won", async () => {
    const { goal, plan, user } = await languageGoalFixture();

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

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
    await connectTestCall(conversationId);

    vi.mocked(checkConversationObjectives).mockResolvedValue(
      objectivesAnswer(RENTING_SCENARIO.objectives.map((item) => item.label)),
    );

    const result = await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
    });

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

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } });
    // C2 reaches a boss only on its saved day, even when its lessons were completed ahead.
    const boss = await planItemFixture({
      kind: "boss",
      phase: 1,
      planId: plan.id,
      position: 10,
      scheduledFor: new Date("2026-10-13"),
    });

    const planItems = await prisma.planItem.findMany({ where: { planId: plan.id } });

    const scheduled = await loadSessionBosses({
      examBlueprintId: null,
      goal: { kind: "language", targetDate: null },
      graphSkills: [],
      itemSkillIds: new Map(),
      items: planItems,
      skills: [],
      today: new Date(),
      userId: user.id,
    });

    expect(items).toHaveLength(4);

    expect(scheduled.checkpoints[0]).toMatchObject({
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
