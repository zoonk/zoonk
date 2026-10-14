import { randomUUID } from "node:crypto";
import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/v2/language/exam-speaking-card";
import {
  LIVE_SESSION_ESTIMATED_MAX_SECONDS,
  LiveCallCreationRefusedError,
} from "@zoonk/ai/tasks/v2/language/live-call-creation";
import {
  closeLiveCallSession,
  createLiveCallSession,
  isLiveCallAvailable,
} from "@zoonk/ai/tasks/v2/language/live-call-session";
import { generateSpeakingMockScenario } from "@zoonk/ai/tasks/v2/language/speaking-mock-scenario";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageProgressView } from "../../view-models/language/get-language-progress-view";
import { loadSpeakingPaper } from "../exam-speaking/_utils/exam-speaking-setup";
import { startSpeakingSection } from "../exam-speaking/start-speaking-section";
import {
  anotherLiveConversation,
  failLiveCallReceiptWrites,
  liveCallFixture,
  liveCallHistoryFixture,
  mockLiveCallAdminSession,
} from "./_test-utils/live-call-fixture";
import { findSpeakingMockSetup } from "./_utils/speaking-mock";
import { closeAllLiveCalls } from "./close-all-live-calls";
import { closeLiveCallConnection } from "./close-live-call-connection";
import { completeLanguageConversation } from "./complete-language-conversation";
import { connectLanguageConversation } from "./connect-language-conversation";
import { endLanguageConversationConnection } from "./end-language-conversation-connection";
import { getLiveCallAdmission, updateLiveCallAdmission } from "./live-call-admission";
import {
  markLiveCallRecoveryUnconfirmed,
  recoverLiveCallConnection,
  recoverLiveCalls,
} from "./recover-live-calls";
import { redeemLiveCallSdp } from "./redeem-live-call-sdp";
import { startLanguageConversation } from "./start-language-conversation";

/** The provider is the only new mocked module; transactions and business capabilities stay real. */
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  closeLiveCallSession: vi.fn(),
  createLiveCallSession: vi.fn(),
  isLiveCallAvailable: vi.fn(),
}));

const SETTINGS = { admission: "all" as const, freeDailyBudgetMicros: 150_000_000 };
const OFFER = "v=0\r\ns=learner-offer\r\n";
/** A provider session's longest possible run plus its creation window, after which it is over. */
const SESSION_SETTLED_MS = (LIVE_SESSION_ESTIMATED_MAX_SECONDS + 60) * 1000;
/** The longest possible run's cost: checks plus two hours at $0.05 a minute. */
const LONGEST_SESSION_MICROS = 6_010_000;
const ANSWER = "v=0\r\ns=provider-answer\r\n";

/** The API's durable Workflow-start boundary; a receipt is required before provider creation. */
function deadlineScheduler() {
  return vi.fn().mockResolvedValue({ runId: `run-${randomUUID()}` });
}

async function reserve(conversationId: string, requestId = randomUUID()) {
  const scheduleDeadline = deadlineScheduler();

  const result = await connectLanguageConversation({
    conversationId,
    input: { requestId },
    scheduleDeadline,
  });

  if (result.status !== "ready") {
    throw new Error(`Reservation refused: ${result.status}`);
  }

  return { ...result.setup, scheduleDeadline };
}

function redeem({
  conversationId,
  connectionId,
}: {
  conversationId: string;
  connectionId: string;
}) {
  return redeemLiveCallSdp({ connectionId, conversationId, input: { sdp: OFFER } });
}

function connection(connectionId: string) {
  return prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connectionId } });
}

/** A possibly billing connection past the health threshold that cleanup never confirmed closed. */
function stuckConnection({ conversation, user }: Awaited<ReturnType<typeof liveCallFixture>>) {
  return liveCallHistoryFixture({
    closedAt: null,
    conversationId: conversation.id,
    deadlineAt: new Date(Date.now() - 301_000),
    liabilityMicros: 135_000,
    state: "closing",
    userId: user.id,
  });
}

function usage({ conversationId, userId }: { conversationId: string; userId: string }) {
  return prisma.usageRecord.findUnique({
    where: { userUsageTarget: { kind: "conversation", targetId: conversationId, userId } },
  });
}

function feedbackAnswer() {
  return {
    data: {
      encouragement: "You arranged the viewing.",
      improve: null,
      pronunciation: [],
      wentWell: ["Can I see it on Saturday?"],
    },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "test",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "test",
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  };
}

describe("server-owned live-call reservation and cleanup", () => {
  const calendar = { day: 0 };

  /** Run this setting-mutating file separately: admission is intentionally global product state. */
  beforeAll(async () => {
    const previous = await prisma.liveCallSetting.findUnique({ where: { id: "live" } });

    afterAll(async () => {
      if (previous) {
        await prisma.liveCallSetting.upsert({
          create: previous,
          update: previous,
          where: { id: "live" },
        });
      } else {
        await prisma.liveCallSetting.deleteMany({ where: { id: "live" } });
      }
    });
  });

  beforeEach(async () => {
    freezeClock();
    /** Independent far-future buckets cannot consume another test file's free-day budget. */
    calendar.day += 1;
    vi.setSystemTime(new Date(Date.UTC(2400, 0, calendar.day, 12)));

    await prisma.liveCallSetting.upsert({
      create: { id: "live", ...SETTINGS },
      update: SETTINGS,
      where: { id: "live" },
    });

    vi.mocked(isLiveCallAvailable).mockReturnValue(true);

    vi.mocked(createLiveCallSession).mockImplementation(async () => ({
      sdp: ANSWER,
      sessionId: `session-${randomUUID()}`,
    }));

    vi.mocked(closeLiveCallSession).mockResolvedValue({
      reason: "closed",
      seconds: 30,
      status: "closed",
    });
  });

  afterEach(async () => {
    await prisma.liveCallSetting.upsert({
      create: { id: "live", ...SETTINGS },
      update: SETTINGS,
      where: { id: "live" },
    });
  });

  it.each(["off", "staff", "provider"] as const)(
    "refuses speaking cards and whole papers before generation when calls are paused by %s",
    async (policy) => {
      const { user } = await liveCallFixture({ plus: true });

      const goal = await goalFixture({
        kind: "language",
        language: "pt",
        targetLanguage: "es",
        title: "DELE B2",
        userId: user.id,
      });

      mockSession(user.id);

      if (policy === "provider") {
        vi.mocked(isLiveCallAvailable).mockReturnValue(false);
      } else {
        await prisma.liveCallSetting.update({ data: { admission: policy }, where: { id: "live" } });
      }

      expect
        .soft(await loadSpeakingPaper({ access: "open", goal }))
        .toMatchObject({ access: "callsPaused" });

      expect
        .soft(await loadSpeakingPaper({ access: "plusRequired", goal }))
        .toMatchObject({ access: "callsPaused" });

      const starts = await Promise.allSettled([
        startLanguageConversation({ goalId: goal.id, kind: "examSpeaking", task: "t1" }),
        startSpeakingSection({ goalId: goal.id }),
      ]);

      expect.soft(starts).toStrictEqual([
        { status: "fulfilled", value: { status: "callsPaused" } },
        { status: "fulfilled", value: { status: "callsPaused" } },
      ]);

      expect(generateExamSpeakingCard).not.toHaveBeenCalled();

      await expect(prisma.languageConversation.count({ where: { goalId: goal.id } })).resolves.toBe(
        0,
      );
    },
  );

  describe.each(["IELTS", "TOEFL"])("%s speaking mock admission", (exam) => {
    it.each(["off", "staff", "provider"] as const)(
      "refuses new and waiting mocks before generation when calls are paused by %s",
      async (policy) => {
        const { user } = await liveCallFixture();

        const goal = await goalFixture({
          kind: "language",
          language: "pt",
          targetLanguage: "en",
          title: exam,
          userId: user.id,
        });

        mockSession(user.id);
        const setup = await findSpeakingMockSetup({ goalId: goal.id, userId: user.id });

        if (!setup) {
          throw new Error("Expected a speaking mock setup");
        }

        if (policy === "provider") {
          vi.mocked(isLiveCallAvailable).mockReturnValue(false);
        } else {
          await prisma.liveCallSetting.update({
            data: { admission: policy },
            where: { id: "live" },
          });
        }

        await expect
          .soft(getLanguageProgressView({ goalId: goal.id }))
          .resolves.toMatchObject({ progress: { speakingMockPaused: true }, status: "ready" });

        const started = await Promise.allSettled([
          startLanguageConversation({ goalId: goal.id, kind: "speakingMock" }),
        ]);

        expect
          .soft(started)
          .toStrictEqual([{ status: "fulfilled", value: { status: "callsPaused" } }]);

        expect.soft(generateSpeakingMockScenario).not.toHaveBeenCalled();

        await expect(
          prisma.languageConversation.count({ where: { goalId: goal.id } }),
        ).resolves.toBe(0);

        const waiting = await prisma.languageConversation.create({
          data: {
            goalId: goal.id,
            kind: "speakingMock",
            language: "pt",
            level: setup.level,
            minutes: 5,
            scenario: { ...RENTING_SCENARIO, exam: setup.exam },
            targetLanguage: "en",
            titleSnapshot: exam,
            userId: user.id,
          },
        });

        await expect(
          startLanguageConversation({ goalId: goal.id, kind: "speakingMock" }),
        ).resolves.toStrictEqual({ status: "callsPaused" });

        await expect(
          prisma.languageConversation.findUnique({ where: { id: waiting.id } }),
        ).resolves.toMatchObject({ startedAt: null, status: "ready" });

        expect(generateSpeakingMockScenario).not.toHaveBeenCalled();
      },
    );
  });

  it("reserves one slot, minute claim and money claim when two tabs start the same call", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);

    const results = await Promise.all([
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ]);

    expect(results.filter(({ status }) => status === "ready")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "previousConnectionClosing")).toHaveLength(1);
    const rows = await prisma.liveCallConnection.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);

    expect(rows[0]).toMatchObject({
      heldSeconds: 120,
      liabilityMicros: 135_000,
      reservedMicros: 135_000,
      state: "pending",
    });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ seconds: 120 });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: rows[0]?.id });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("admits only one of two different calls for the same learner", async () => {
    const { conversation, user } = await liveCallFixture();
    const other = await anotherLiveConversation({ userId: user.id });
    mockSession(user.id);

    const results = await Promise.all(
      [conversation.id, other.id].map((conversationId) =>
        connectLanguageConversation({ conversationId, scheduleDeadline: deadlineScheduler() }),
      ),
    );

    expect(results.filter(({ status }) => status === "ready")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "callInProgress")).toHaveLength(1);

    await expect(
      prisma.usageRecord.count({ where: { kind: "conversation", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("reuses an explicit request ID and its durable timer receipt without another claim", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const requestId = randomUUID();
    const first = await reserve(conversation.id, requestId);
    const firstRow = await connection(first.connectionId);
    const duplicateScheduler = deadlineScheduler();
    vi.setSystemTime(new Date(Date.now() + 30_000));

    const duplicate = await connectLanguageConversation({
      conversationId: conversation.id,
      input: { requestId },
      scheduleDeadline: duplicateScheduler,
    });

    expect(duplicate).toMatchObject({
      setup: {
        connectionId: first.connectionId,
        deadlineAt: first.deadlineAt,
        generation: first.generation,
        seconds: first.seconds - 30,
      },
      status: "ready",
    });

    expect(duplicateScheduler).not.toHaveBeenCalled();

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      deadlineAt: firstRow.deadlineAt,
      workflowRunId: firstRow.workflowRunId,
    });

    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ seconds: 120 });
  });

  it.each([
    { period: "day", usedSeconds: 60 },
    { period: "month", usedSeconds: 240 },
  ])(
    "preserves a shortened $period limit when replaying a request after thirty seconds",
    async ({ period, usedSeconds }) => {
      const { conversation, user } = await liveCallFixture();

      await usageRecordsFixture({
        count: 1,
        createdAt: period === "day" ? new Date() : new Date(Date.now() - 86_400_000),
        kind: "conversation",
        seconds: usedSeconds,
        userId: user.id,
      });

      mockSession(user.id);
      const requestId = randomUUID();
      const first = await reserve(conversation.id, requestId);
      const firstRow = await connection(first.connectionId);
      expect(first).toMatchObject({ endsAtLimit: period, seconds: 60 });
      vi.setSystemTime(new Date(Date.now() + 30_000));
      const duplicateScheduler = deadlineScheduler();

      await expect(
        connectLanguageConversation({
          conversationId: conversation.id,
          input: { requestId },
          scheduleDeadline: duplicateScheduler,
        }),
      ).resolves.toMatchObject({
        setup: {
          connectionId: first.connectionId,
          deadlineAt: first.deadlineAt,
          endsAtLimit: period,
          seconds: 30,
        },
        status: "ready",
      });

      await expect(connection(first.connectionId)).resolves.toMatchObject({
        heldSeconds: 60,
        shortenedBy: period,
        workflowRunId: firstRow.workflowRunId,
      });

      expect(duplicateScheduler).not.toHaveBeenCalled();

      await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(
        1,
      );

      await expect(
        usage({ conversationId: conversation.id, userId: user.id }),
      ).resolves.toMatchObject({ seconds: 60 });
    },
  );

  it("rolls back the minute and dollar claims when the global free-day budget refuses", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);

    await prisma.liveCallSetting.update({
      data: { freeDailyBudgetMicros: 134_999 },
      where: { id: "live" },
    });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({
      limit: { period: "day", resource: "aiSpend" },
      status: "limitReached",
    });

    await expect(usage({ conversationId: conversation.id, userId: user.id })).resolves.toBeNull();
    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.freeCallSpendDay.findUnique({
        where: { day: new Date(new Date().toISOString().slice(0, 10)) },
      }),
    ).resolves.toBeNull();
  });

  it("does not end a newer same-call session when an older request ID is replayed", async () => {
    const { conversation, user } = await liveCallFixture({ plus: true });
    mockSession(user.id);
    const oldRequestId = randomUUID();
    const first = await reserve(conversation.id, oldRequestId);
    await redeem({ connectionId: first.connectionId, conversationId: conversation.id });
    const second = await reserve(conversation.id);
    await redeem({ connectionId: second.connectionId, conversationId: conversation.id });
    const closeCalls = vi.mocked(closeLiveCallSession).mock.calls.length;
    const duplicateScheduler = deadlineScheduler();

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        input: { requestId: oldRequestId },
        scheduleDeadline: duplicateScheduler,
      }),
    ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

    await expect(connection(second.connectionId)).resolves.toMatchObject({ state: "active" });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: second.connectionId, generation: second.generation });

    expect(closeLiveCallSession).toHaveBeenCalledTimes(closeCalls);
    expect(duplicateScheduler).not.toHaveBeenCalled();
    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it("rejects delayed old-tab completion without closing a newer connection or starting feedback", async () => {
    const { conversation, user } = await liveCallFixture({ plus: true });
    mockSession(user.id);
    const first = await reserve(conversation.id);
    await redeem({ connectionId: first.connectionId, conversationId: conversation.id });
    const second = await reserve(conversation.id);
    await redeem({ connectionId: second.connectionId, conversationId: conversation.id });
    const closeCalls = vi.mocked(closeLiveCallSession).mock.calls.length;

    await expect(
      completeLanguageConversation({
        conversationId: conversation.id,
        input: {
          connectionId: first.connectionId,
          spokenSeconds: 30,
          turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
          usedHelp: false,
        },
      }),
    ).resolves.toStrictEqual({ status: "conversationEnded" });

    await expect(connection(second.connectionId)).resolves.toMatchObject({ state: "active" });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: second.connectionId });

    await expect(
      prisma.languageConversation.findUnique({ where: { id: conversation.id } }),
    ).resolves.toMatchObject({ completionStartedAt: null, feedback: null, status: "ready" });

    expect(closeLiveCallSession).toHaveBeenCalledTimes(closeCalls);
    expect(writeConversationFeedback).not.toHaveBeenCalled();
    expect(checkConversationObjectives).not.toHaveBeenCalled();
  });

  it("authorizes the exact completion connection and conversation before closing or latching", async () => {
    const [owner, stranger] = await Promise.all([liveCallFixture(), liveCallFixture()]);
    mockSession(owner.user.id);
    const setup = await reserve(owner.conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: owner.conversation.id });
    const other = await anotherLiveConversation({ userId: owner.user.id });

    const otherConnection = await liveCallHistoryFixture({
      conversationId: other.id,
      userId: owner.user.id,
    });

    mockSession(stranger.user.id);
    const foreign = await reserve(stranger.conversation.id);

    const input = {
      connectionId: setup.connectionId,
      spokenSeconds: 0,
      turns: [],
      usedHelp: false,
    };

    mockSession(null);

    await expect(
      completeLanguageConversation({ conversationId: owner.conversation.id, input }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(stranger.user.id);

    await expect(
      completeLanguageConversation({ conversationId: owner.conversation.id, input }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(owner.user.id);

    await expect(
      completeLanguageConversation({
        conversationId: owner.conversation.id,
        input: { ...input, connectionId: foreign.connectionId },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      completeLanguageConversation({
        conversationId: owner.conversation.id,
        input: { ...input, connectionId: otherConnection.id },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({ state: "active" });

    await expect(
      prisma.languageConversation.findUnique({ where: { id: owner.conversation.id } }),
    ).resolves.toMatchObject({ completionStartedAt: null, status: "ready" });

    expect(closeLiveCallSession).not.toHaveBeenCalled();
    expect(writeConversationFeedback).not.toHaveBeenCalled();
  });

  it("rolls back a minute hold when previous connection costs exhaust the monthly dollar budget", async () => {
    const { conversation, user } = await liveCallFixture();

    await liveCallHistoryFixture({
      conversationId: randomUUID(),
      settledMicros: 300_000,
      userId: user.id,
    });

    mockSession(user.id);

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({
      limit: { period: "month", resource: "aiSpend" },
      status: "limitReached",
    });

    await expect(usage({ conversationId: conversation.id, userId: user.id })).resolves.toBeNull();

    await expect(
      prisma.liveCallConnection.count({ where: { conversationId: conversation.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();
  });

  it("does not claim a slot or money when the learner has spent today's call time", async () => {
    const { conversation, user } = await liveCallFixture();
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 120, userId: user.id });
    mockSession(user.id);

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ limit: { resource: "callSeconds" }, status: "limitReached" });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();

    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it.each([
    { count: 6, period: "conversation" },
    { count: 30, period: "day" },
  ])("enforces the $period attempt cap before reserving more time", async ({ count, period }) => {
    const { conversation, user } = await liveCallFixture();

    const sharedUsage =
      period === "conversation"
        ? await prisma.usageRecord.create({
            data: { kind: "conversation", targetId: conversation.id, userId: user.id },
          })
        : null;

    await Promise.all(
      Array.from({ length: count }, () =>
        liveCallHistoryFixture({
          conversationId: period === "conversation" ? conversation.id : randomUUID(),
          usageRecordId: sharedUsage?.id,
          userId: user.id,
        }),
      ),
    );

    mockSession(user.id);
    const before = await usage({ conversationId: conversation.id, userId: user.id });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ period, status: "connectionLimitReached" });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toStrictEqual(before);

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("refunds a failed Workflow start before any SDP can be redeemed", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const scheduleDeadline = vi.fn().mockRejectedValue(new Error("Workflow unavailable"));

    await expect(
      connectLanguageConversation({ conversationId: conversation.id, scheduleDeadline }),
    ).resolves.toStrictEqual({ status: "retryable" });

    const rows = await prisma.liveCallConnection.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);

    expect(rows[0]).toMatchObject({
      endReason: "timerFailed",
      liabilityMicros: 0,
      settledMicros: 0,
      state: "closed",
      workflowRunId: null,
    });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 0, seconds: 0 });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: null });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("reads off, staff and all admission freshly at reservation", async () => {
    const [learner, staff] = await Promise.all([
      liveCallFixture(),
      liveCallFixture({ role: "admin" }),
    ]);

    mockSession(learner.user.id);
    await prisma.liveCallSetting.update({ data: { admission: "off" }, where: { id: "live" } });

    await expect(
      connectLanguageConversation({
        conversationId: learner.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    await prisma.liveCallSetting.update({ data: { admission: "staff" }, where: { id: "live" } });

    await expect(
      connectLanguageConversation({
        conversationId: learner.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    mockSession(staff.user.id);
    await reserve(staff.conversation.id);
    await prisma.liveCallSetting.update({ data: { admission: "all" }, where: { id: "live" } });
    mockSession(learner.user.id);
    await reserve(learner.conversation.id);
  });

  it("refuses unavailable provider access without scheduling or creating a session", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    vi.mocked(isLiveCallAvailable).mockReturnValue(false);
    const scheduleDeadline = deadlineScheduler();

    await expect(
      connectLanguageConversation({ conversationId: conversation.id, scheduleDeadline }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    expect(scheduleDeadline).not.toHaveBeenCalled();
    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("pauses calls when admission configuration is missing or invalid", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    await prisma.liveCallSetting.delete({ where: { id: "live" } });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    await prisma.liveCallSetting.create({
      data: { admission: "all", freeDailyBudgetMicros: -1, id: "live" },
    });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("requires a persisted Workflow receipt before SDP redemption", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const scheduled = Promise.withResolvers<{ connectionId: string }>();
    const receipt = Promise.withResolvers<{ runId: string }>();

    const reservation = connectLanguageConversation({
      conversationId: conversation.id,
      scheduleDeadline: (input) => {
        scheduled.resolve(input);
        return receipt.promise;
      },
    });

    const { connectionId } = await scheduled.promise;

    await expect(redeem({ connectionId, conversationId: conversation.id })).resolves.toMatchObject({
      status: "retryable",
    });

    expect(createLiveCallSession).not.toHaveBeenCalled();
    receipt.resolve({ runId: `run-${randomUUID()}` });
    await expect(reservation).resolves.toMatchObject({ status: "ready" });
  });

  it("reads admission again before redeeming a reserved ticket", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await prisma.liveCallSetting.update({ data: { admission: "off" }, where: { id: "live" } });

    await expect(
      redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it.each(["checkpoint", "examSpeaking"] as const)(
    "rechecks provider availability and Plus access before %s SDP can spend",
    async (kind) => {
      const { conversation, user } = await liveCallFixture({ kind, plus: true });
      mockSession(user.id);
      const setup = await reserve(conversation.id);
      vi.mocked(isLiveCallAvailable).mockReturnValue(false);

      await expect(
        redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
      ).resolves.toStrictEqual({ status: "callsPaused" });

      vi.mocked(isLiveCallAvailable).mockReturnValue(true);

      await prisma.subscription.updateMany({
        data: { status: "canceled" },
        where: { referenceId: user.id },
      });

      await expect(
        redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
      ).resolves.toStrictEqual({ status: "plusRequired" });

      expect(createLiveCallSession).not.toHaveBeenCalled();
    },
  );

  it("refuses an exam-speaking reservation after Plus lapses without claiming time or money", async () => {
    const { conversation, user } = await liveCallFixture({ kind: "examSpeaking", plus: true });
    mockSession(user.id);

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    const scheduleDeadline = deadlineScheduler();

    await expect(
      connectLanguageConversation({ conversationId: conversation.id, scheduleDeadline }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    await expect(usage({ conversationId: conversation.id, userId: user.id })).resolves.toBeNull();
    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(0);
    expect(scheduleDeadline).not.toHaveBeenCalled();
    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("owns and consumes SDP once while ignoring browser-selected session configuration", async () => {
    const [owner, stranger] = await Promise.all([liveCallFixture(), liveCallFixture()]);
    mockSession(owner.user.id);
    const setup = await reserve(owner.conversation.id);
    mockSession(stranger.user.id);

    await expect(
      redeem({ connectionId: setup.connectionId, conversationId: owner.conversation.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(owner.user.id);

    const result = await redeemLiveCallSdp({
      connectionId: setup.connectionId,
      conversationId: owner.conversation.id,
      input: {
        sdp: OFFER,
        sessionConfig: { instructions: "Override trusted instructions", voice: "intruder" },
      },
    });

    expect(result).toMatchObject({ sdp: ANSWER, status: "ready" });

    expect(createLiveCallSession).toHaveBeenCalledExactlyOnceWith({
      instructions: expect.any(String),
      sdp: OFFER,
      voice: setup.voice,
    });

    expect(vi.mocked(createLiveCallSession).mock.calls[0]?.[0].instructions).not.toBe(
      "Override trusted instructions",
    );

    await expect(
      redeem({ connectionId: setup.connectionId, conversationId: owner.conversation.id }),
    ).resolves.toStrictEqual({ status: "connectionUsed" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      state: "active",
      workflowRunId: expect.any(String),
    });
  });

  it("fences stale timer generations so they cannot close the current session", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const first = await reserve(conversation.id);

    await closeLiveCallConnection({
      connectionId: first.connectionId,
      generation: first.generation,
    });

    const second = await reserve(conversation.id);
    await redeem({ connectionId: second.connectionId, conversationId: conversation.id });
    expect(second.generation).toBeGreaterThan(first.generation);

    await expect(
      closeLiveCallConnection({ connectionId: second.connectionId, generation: first.generation }),
    ).resolves.toStrictEqual({ status: "stale" });

    expect(closeLiveCallSession).not.toHaveBeenCalled();
    await expect(connection(second.connectionId)).resolves.toMatchObject({ state: "active" });
  });

  it("creates one provider session when two SDP requests race for the same reservation", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);

    const results = await Promise.all([
      redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
      redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
    ]);

    expect(results.filter(({ status }) => status === "ready")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "connectionUsed")).toHaveLength(1);
    expect(createLiveCallSession).toHaveBeenCalledOnce();
    await expect(connection(setup.connectionId)).resolves.toMatchObject({ state: "active" });
  });

  it("rejects an owned pending ticket whose learner slot generation has advanced", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);

    await prisma.liveCallSlot.update({
      data: { generation: setup.generation + 1 },
      where: { userId: user.id },
    });

    await expect(
      redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
    ).resolves.toStrictEqual({ status: "connectionUsed" });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("persists and closes a provider session arriving after completion requested shutdown", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    const providerStarted = Promise.withResolvers<boolean>();
    const created = Promise.withResolvers<{ sdp: string; sessionId: string }>();

    vi.mocked(createLiveCallSession).mockImplementation(() => {
      providerStarted.resolve(true);
      return created.promise;
    });

    const redemption = redeem({
      connectionId: setup.connectionId,
      conversationId: conversation.id,
    });

    await providerStarted.promise;

    await expect(
      completeLanguageConversation({
        conversationId: conversation.id,
        input: { connectionId: setup.connectionId, spokenSeconds: 0, turns: [], usedHelp: false },
      }),
    ).resolves.toMatchObject({ status: "previousConnectionClosing" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({ state: "closing" });
    created.resolve({ sdp: ANSWER, sessionId: `late-${randomUUID()}` });
    await expect(redemption).resolves.not.toMatchObject({ status: "ready" });
    const closed = await connection(setup.connectionId);

    expect(closed).toMatchObject({
      providerSessionId: expect.stringMatching(/^late-/u),
      state: "closed",
    });

    expect(closeLiveCallSession).toHaveBeenCalledWith(closed.providerSessionId);
  });

  it("renews an active review and completes concurrent callers with one review", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const { conversation, user } = await liveCallFixture({ plus: true });
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    const started = Promise.withResolvers<boolean>();
    const feedback = Promise.withResolvers<Awaited<ReturnType<typeof writeConversationFeedback>>>();

    vi.mocked(writeConversationFeedback).mockImplementationOnce(() => {
      started.resolve(true);
      return feedback.promise;
    });

    const input = {
      connectionId: setup.connectionId,
      spokenSeconds: 30,
      turns: [{ speaker: "learner" as const, text: "Can I see it on Saturday?" }],
      usedHelp: false,
    };

    const first = completeLanguageConversation({ conversationId: conversation.id, input });
    await started.promise;

    try {
      /** Advance past the original lease, letting each real database heartbeat commit. */
      await Array.from({ length: 22 }).reduce(async (previous) => {
        await previous;

        const beforeRenewal = await prisma.languageConversation.findUniqueOrThrow({
          where: { id: conversation.id },
        });

        await vi.advanceTimersByTimeAsync(30_000);

        await expect
          .poll(
            async () => {
              const row = await prisma.languageConversation.findUniqueOrThrow({
                where: { id: conversation.id },
              });

              return row.updatedAt.getTime();
            },
            { interval: 1 },
          )
          .toBeGreaterThan(beforeRenewal.updatedAt.getTime());
      }, Promise.resolve());

      await expect(
        completeLanguageConversation({ conversationId: conversation.id, input }),
      ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

      expect(writeConversationFeedback).toHaveBeenCalledOnce();
      expect(checkConversationObjectives).toHaveBeenCalledOnce();
    } finally {
      feedback.resolve(feedbackAnswer());
    }

    const completed = await first;
    expect(completed.status).toBe("completed");

    await expect(
      completeLanguageConversation({ conversationId: conversation.id, input }),
    ).resolves.toStrictEqual(completed);

    expect(writeConversationFeedback).toHaveBeenCalledOnce();
    expect(checkConversationObjectives).toHaveBeenCalledOnce();

    await expect(
      prisma.learningEvent.count({
        where: { contentIds: { equals: conversation.id, path: ["conversationId"] } },
      }),
    ).resolves.toBe(1);
  });

  it("does not start feedback when a paused objective review has lost its claim", async () => {
    const { conversation, user } = await liveCallFixture({ plus: true });
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    const started = Promise.withResolvers<boolean>();
    const resume = Promise.withResolvers<boolean>();
    const checked = { ...feedbackAnswer(), data: { met: [] } };
    vi.mocked(checkConversationObjectives).mockResolvedValue(checked);

    vi.mocked(checkConversationObjectives).mockImplementationOnce(async () => {
      started.resolve(true);
      await resume.promise;
      return checked;
    });

    const input = {
      connectionId: setup.connectionId,
      spokenSeconds: 30,
      turns: [{ speaker: "learner" as const, text: "Can I see it on Saturday?" }],
      usedHelp: false,
    };

    const first = completeLanguageConversation({ conversationId: conversation.id, input });
    await started.promise;
    const stale = new Date(Date.now() - 11 * 60 * 1000);

    await prisma.languageConversation.update({
      data: { updatedAt: stale },
      where: { id: conversation.id },
    });

    try {
      const replacement = await completeLanguageConversation({
        conversationId: conversation.id,
        input,
      });

      expect(replacement.status).toBe("completed");
      resume.resolve(true);
      await expect(first).resolves.toStrictEqual(replacement);
      expect(writeConversationFeedback).toHaveBeenCalledOnce();
    } finally {
      resume.resolve(true);
    }
  });

  it("takes over an interrupted completion claim without reopening the call", async () => {
    const { conversation, user } = await liveCallFixture({ plus: true });
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });

    await endLanguageConversationConnection({
      connectionId: setup.connectionId,
      conversationId: conversation.id,
    });

    const abandoned = new Date(Date.now() - 11 * 60 * 1000);

    await prisma.languageConversation.update({
      data: { completionStartedAt: abandoned, updatedAt: abandoned },
      where: { id: conversation.id },
    });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "conversationEnded" });

    await expect(
      completeLanguageConversation({
        conversationId: conversation.id,
        input: {
          connectionId: setup.connectionId,
          spokenSeconds: 30,
          turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
          usedHelp: false,
        },
      }),
    ).resolves.toMatchObject({ status: "completed" });

    expect(writeConversationFeedback).toHaveBeenCalledOnce();

    const row = await prisma.languageConversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });

    expect(row.completionStartedAt).not.toStrictEqual(abandoned);
  });

  it.each([false, true])(
    "fences reconnect and SDP while completion feedback is pending (pending reconnect: %s)",
    async (pendingReconnect) => {
      const { conversation, user } = await liveCallFixture({ plus: true });
      mockSession(user.id);
      const first = await reserve(conversation.id);
      await redeem({ connectionId: first.connectionId, conversationId: conversation.id });
      const ticket = pendingReconnect ? await reserve(conversation.id) : first;

      await prisma.languageConversation.update({
        data: { objectivesMet: RENTING_SCENARIO.objectives.map(({ label }) => label) },
        where: { id: conversation.id },
      });

      const feedbackStarted = Promise.withResolvers<boolean>();

      const feedback =
        Promise.withResolvers<Awaited<ReturnType<typeof writeConversationFeedback>>>();

      vi.mocked(writeConversationFeedback).mockImplementationOnce(() => {
        feedbackStarted.resolve(true);
        return feedback.promise;
      });

      const completing = completeLanguageConversation({
        conversationId: conversation.id,
        input: {
          connectionId: ticket.connectionId,
          spokenSeconds: 30,
          turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
          usedHelp: false,
        },
      });

      await feedbackStarted.promise;

      try {
        await expect(
          prisma.languageConversation.findUnique({ where: { id: conversation.id } }),
        ).resolves.toMatchObject({ completionStartedAt: expect.any(Date), status: "ready" });

        const scheduleDeadline = deadlineScheduler();

        await expect(
          connectLanguageConversation({ conversationId: conversation.id, scheduleDeadline }),
        ).resolves.toStrictEqual({ status: "conversationEnded" });

        await expect(
          redeem({ connectionId: ticket.connectionId, conversationId: conversation.id }),
        ).resolves.toStrictEqual({ status: "conversationEnded" });

        expect(scheduleDeadline).not.toHaveBeenCalled();
        expect(createLiveCallSession).toHaveBeenCalledOnce();
      } finally {
        feedback.resolve(feedbackAnswer());
      }

      await expect(completing).resolves.toMatchObject({ status: "completed" });

      await expect(
        completeLanguageConversation({
          conversationId: conversation.id,
          input: {
            connectionId: ticket.connectionId,
            spokenSeconds: 30,
            turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
            usedHelp: false,
          },
        }),
      ).resolves.toMatchObject({ status: "completed" });

      expect(writeConversationFeedback).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { change: "admission", kind: "checkpoint" as const },
    { change: "subscription", kind: "checkpoint" as const },
    { change: "admission", kind: "examSpeaking" as const },
    { change: "subscription", kind: "examSpeaking" as const },
  ])(
    "closes late $kind creation after $change access changes instead of returning its SDP",
    async ({ change, kind }) => {
      const { conversation, user } = await liveCallFixture({ kind, plus: true });
      mockSession(user.id);
      const setup = await reserve(conversation.id);
      const providerStarted = Promise.withResolvers<boolean>();
      const created = Promise.withResolvers<{ sdp: string; sessionId: string }>();

      vi.mocked(createLiveCallSession).mockImplementationOnce(() => {
        providerStarted.resolve(true);
        return created.promise;
      });

      const redemption = redeem({
        connectionId: setup.connectionId,
        conversationId: conversation.id,
      });

      await providerStarted.promise;

      if (change === "admission") {
        await prisma.liveCallSetting.update({ data: { admission: "off" }, where: { id: "live" } });
      } else {
        await prisma.subscription.updateMany({
          data: { status: "canceled" },
          where: { referenceId: user.id },
        });
      }

      const sessionId = `late-access-${randomUUID()}`;
      created.resolve({ sdp: ANSWER, sessionId });
      await expect(redemption).resolves.toStrictEqual({ status: "previousConnectionClosing" });

      await expect(connection(setup.connectionId)).resolves.toMatchObject({
        providerSessionId: sessionId,
        state: "closed",
      });

      expect(closeLiveCallSession).toHaveBeenCalledExactlyOnceWith(sessionId);

      await expect(
        prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ connectionId: null });
    },
  );

  it("holds an ID-less ambiguous creation liable, then closes it at its deadline with the estimated cost kept", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);

    vi.mocked(createLiveCallSession).mockRejectedValue(
      new Error("Create response lost after request"),
    );

    await expect(
      redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
    ).resolves.toStrictEqual({ status: "retryable" });

    const held = await connection(setup.connectionId);

    expect(held).toMatchObject({
      costConfidence: "unconfirmed",
      liabilityMicros: 135_000,
      providerSessionId: null,
      state: "closing",
    });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: setup.connectionId });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

    vi.setSystemTime(new Date(new Date(setup.deadlineAt).getTime() + 1000));

    await expect(
      recoverLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costConfidence: "estimated",
      liabilityMicros: 0,
      providerSessionId: null,
      settledMicros: 135_000,
      state: "closed",
    });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: held.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 135_000 });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 135_000, seconds: 0 });

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });

    expect(closeLiveCallSession).not.toHaveBeenCalled();
  });

  it("releases a provider-refused creation at the shortest call's cost, so cleanup never pauses other learners", async () => {
    const [refused, other] = await Promise.all([liveCallFixture(), liveCallFixture()]);
    mockSession(refused.user.id);
    const setup = await reserve(refused.conversation.id);
    vi.mocked(createLiveCallSession).mockRejectedValueOnce(new LiveCallCreationRefusedError(400));

    await expect(
      redeem({ connectionId: setup.connectionId, conversationId: refused.conversation.id }),
    ).resolves.toStrictEqual({ status: "retryable" });

    const released = await connection(setup.connectionId);

    expect(released).toMatchObject({
      costConfidence: "estimated",
      liabilityMicros: 0,
      providerSessionId: null,
      settledMicros: 22_500,
      state: "closed",
    });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: released.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 22_500 });

    await expect(
      usage({ conversationId: refused.conversation.id, userId: refused.user.id }),
    ).resolves.toMatchObject({ costMicros: 22_500, seconds: 0 });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: refused.user.id } }),
    ).resolves.toMatchObject({ connectionId: null });

    vi.setSystemTime(new Date(new Date(setup.deadlineAt).getTime() + 301_000));

    await expect(
      recoverLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    mockSession(other.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: other.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });

    mockSession(refused.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: refused.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });

    expect(closeLiveCallSession).not.toHaveBeenCalled();
  });

  it.each(["persisted", "compensated"] as const)(
    "keeps a late %s provider session owed after its ID-less row closed, then settles its real cost without touching a newer call",
    async (receipt) => {
      const { conversation, user } = await liveCallFixture();
      mockSession(user.id);
      const setup = await reserve(conversation.id);
      const providerStarted = Promise.withResolvers<boolean>();
      const created = Promise.withResolvers<{ sdp: string; sessionId: string }>();
      const sessionId = `late-${randomUUID()}`;

      vi.mocked(createLiveCallSession).mockImplementation(() => {
        providerStarted.resolve(true);
        return created.promise;
      });

      const redemption = redeem({
        connectionId: setup.connectionId,
        conversationId: conversation.id,
      });

      await providerStarted.promise;
      vi.setSystemTime(new Date(new Date(setup.deadlineAt).getTime() + 1000));

      await expect(
        recoverLiveCallConnection({
          connectionId: setup.connectionId,
          generation: setup.generation,
        }),
      ).resolves.toStrictEqual({ status: "closed" });

      const replacement = await reserve(conversation.id);
      const held = await usage({ conversationId: conversation.id, userId: user.id });

      const fault =
        receipt === "compensated"
          ? await failLiveCallReceiptWrites({ connectionId: setup.connectionId, failures: 3 })
          : null;

      try {
        vi.mocked(closeLiveCallSession).mockRejectedValueOnce(new Error("Sideband attach failed"));
        created.resolve({ sdp: ANSWER, sessionId });
        await expect(redemption).resolves.toStrictEqual({ status: "previousConnectionClosing" });
      } finally {
        await fault?.restore();
      }

      await expect(connection(setup.connectionId)).resolves.toMatchObject({
        costConfidence: "unconfirmed",
        liabilityMicros: 135_000,
        providerSessionId: sessionId,
        settledMicros: 0,
        state: "closing",
      });

      vi.mocked(closeLiveCallSession).mockResolvedValue({
        reason: "closed",
        seconds: 90,
        status: "closed",
      });

      await recoverLiveCalls();
      const settled = await connection(setup.connectionId);

      expect(settled).toMatchObject({
        costConfidence: "confirmed",
        liabilityMicros: 0,
        settledMicros: 85_000,
        state: "closed",
      });

      await expect(connection(replacement.connectionId)).resolves.toMatchObject({
        state: "pending",
      });

      await expect(
        prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ connectionId: replacement.connectionId });

      expect(held).toMatchObject({ seconds: 120 });

      await expect(
        usage({ conversationId: conversation.id, userId: user.id }),
      ).resolves.toMatchObject({ costMicros: 220_000, seconds: 120 });

      await expect(
        prisma.freeCallSpendDay.findUnique({ where: { day: settled.freeSpendDay! } }),
      ).resolves.toMatchObject({ spentMicros: 220_000 });

      expect(closeLiveCallSession).toHaveBeenCalledTimes(2);
      expect(closeLiveCallSession).toHaveBeenCalledWith(sessionId);
    },
  );

  it("retries a failed provider receipt without recreating the session and retains it for durable close recovery", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    const sessionId = `receipt-retry-${randomUUID()}`;

    const fault = await failLiveCallReceiptWrites({
      connectionId: setup.connectionId,
      failures: 1,
    });

    try {
      vi.mocked(createLiveCallSession).mockImplementationOnce(async () => {
        vi.setSystemTime(new Date(new Date(setup.deadlineAt).getTime() + 1000));
        return { sdp: ANSWER, sessionId };
      });

      vi.mocked(closeLiveCallSession).mockRejectedValueOnce(
        new Error("First shutdown receipt unavailable"),
      );

      await expect(
        redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
      ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

      await expect(fault.attempts()).resolves.toBe(2);

      await expect(connection(setup.connectionId)).resolves.toMatchObject({
        providerSessionId: sessionId,
        state: "closing",
      });

      await expect(
        prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ connectionId: setup.connectionId });

      await expect(
        recoverLiveCallConnection({
          connectionId: setup.connectionId,
          generation: setup.generation,
        }),
      ).resolves.toStrictEqual({ status: "closed" });

      await expect(connection(setup.connectionId)).resolves.toMatchObject({
        costConfidence: "confirmed",
        providerSessionId: sessionId,
        settledMicros: 35_000,
        state: "closed",
      });

      expect(createLiveCallSession).toHaveBeenCalledOnce();
      expect(closeLiveCallSession).toHaveBeenCalledTimes(2);
    } finally {
      await fault.restore();
    }
  });

  it("persists a provider ID after three receipt failures and settles its confirmed compensation close once", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    const sessionId = `compensated-${randomUUID()}`;

    const fault = await failLiveCallReceiptWrites({
      connectionId: setup.connectionId,
      failures: 3,
    });

    try {
      vi.mocked(createLiveCallSession).mockResolvedValueOnce({ sdp: ANSWER, sessionId });

      await expect(
        redeem({ connectionId: setup.connectionId, conversationId: conversation.id }),
      ).resolves.not.toMatchObject({ status: "ready" });

      await expect(fault.attempts()).resolves.toBe(4);

      await expect(connection(setup.connectionId)).resolves.toMatchObject({
        costConfidence: "confirmed",
        liabilityMicros: 0,
        providerSessionId: sessionId,
        settledMicros: 35_000,
        state: "closed",
      });

      await expect(
        prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ connectionId: null });

      await expect(
        closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
      ).resolves.toStrictEqual({ status: "closed" });

      await expect(
        usage({ conversationId: conversation.id, userId: user.id }),
      ).resolves.toMatchObject({ costMicros: 35_000, seconds: 30 });

      expect(createLiveCallSession).toHaveBeenCalledOnce();
      expect(closeLiveCallSession).toHaveBeenCalledExactlyOnceWith(sessionId);
    } finally {
      await fault.restore();
    }
  });

  it("keeps a timed-out close pending and settles concurrent successful retries exactly once", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    vi.mocked(closeLiveCallSession).mockRejectedValueOnce(new Error("Finalization timed out"));

    await expect(
      endLanguageConversationConnection({
        connectionId: setup.connectionId,
        conversationId: conversation.id,
      }),
    ).resolves.toMatchObject({ status: "previousConnectionClosing" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      liabilityMicros: 135_000,
      settledMicros: 0,
      state: "closing",
    });

    vi.mocked(closeLiveCallSession).mockResolvedValue({
      reason: "closed",
      seconds: 0,
      status: "closed",
    });

    const closed = await Promise.all([
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ]);

    expect(closed).toStrictEqual([{ status: "closed" }, { status: "closed" }]);

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costConfidence: "confirmed",
      liabilityMicros: 0,
      settledMicros: 22_500,
      state: "closed",
    });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 22_500, seconds: 0 });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: null });

    const row = await connection(setup.connectionId);

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: row.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 22_500 });
  });

  it("does not close early and refunds an unredeemed reservation at its absolute deadline", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);

    await expect(
      recoverLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ deadlineAt: new Date(setup.deadlineAt), status: "notDue" });

    vi.setSystemTime(new Date(setup.deadlineAt));

    await expect(
      recoverLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      liabilityMicros: 0,
      settledMicros: 0,
      state: "closed",
    });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 0, seconds: 0 });

    expect(createLiveCallSession).not.toHaveBeenCalled();
    expect(closeLiveCallSession).not.toHaveBeenCalled();
  });

  it("preserves the original challenge deadline through a reconnect below one minute", async () => {
    const { conversation, user } = await liveCallFixture({
      kind: "checkpoint",
      minutes: 3,
      plus: true,
    });

    mockSession(user.id);
    const first = await reserve(conversation.id);
    await redeem({ connectionId: first.connectionId, conversationId: conversation.id });
    vi.setSystemTime(new Date(Date.now() + 150_000));

    vi.mocked(closeLiveCallSession).mockResolvedValue({
      reason: "closed",
      seconds: 150,
      status: "closed",
    });

    const reconnected = await reserve(conversation.id);
    expect(reconnected).toMatchObject({ deadlineAt: first.deadlineAt, seconds: 30 });

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      endReason: "reconnect",
      state: "closed",
    });

    vi.setSystemTime(new Date(new Date(first.deadlineAt).getTime() + 1));

    await expect(
      redeem({ connectionId: reconnected.connectionId, conversationId: conversation.id }),
    ).resolves.toStrictEqual({ status: "connectionExpired" });
  });

  it("bounds the daily-sweeps fallback and leaves future reservations untouched", async () => {
    const [overdue, future] = await Promise.all([liveCallFixture(), liveCallFixture()]);
    mockSession(overdue.user.id);
    const expiredSetup = await reserve(overdue.conversation.id);
    mockSession(future.user.id);
    const futureSetup = await reserve(future.conversation.id);

    await prisma.liveCallConnection.update({
      data: { deadlineAt: new Date(Date.now() - 1000) },
      where: { id: expiredSetup.connectionId },
    });

    await expect(recoverLiveCalls({ limit: 1 })).resolves.toMatchObject({
      attempted: 1,
      closed: 1,
    });

    await expect(connection(expiredSetup.connectionId)).resolves.toMatchObject({ state: "closed" });
    await expect(connection(futureSetup.connectionId)).resolves.toMatchObject({ state: "pending" });
    expect(closeLiveCallSession).not.toHaveBeenCalled();
  });

  it.each(["recovery", "admin"])(
    "does not starve a known overdue session behind an unknown older creation during bounded %s cleanup",
    async (mode) => {
      const [known, unknown, admin] = await Promise.all([
        liveCallFixture({ plus: true }),
        liveCallFixture({ plus: true }),
        liveCallFixture({ role: "admin" }),
      ]);

      mockSession(known.user.id);
      const setup = await reserve(known.conversation.id);
      await redeem({ connectionId: setup.connectionId, conversationId: known.conversation.id });

      await prisma.liveCallConnection.update({
        data: { deadlineAt: new Date(Date.now() - 1000) },
        where: { id: setup.connectionId },
      });

      const unresolved = await liveCallHistoryFixture({
        closedAt: null,
        conversationId: unknown.conversation.id,
        costConfidence: "unconfirmed",
        deadlineAt: new Date(Date.now() - 2000),
        heldSeconds: 120,
        liabilityMicros: 135_000,
        providerStartedAt: new Date(Date.now() - 3000),
        reservedMicros: 135_000,
        state: "creating",
        userId: unknown.user.id,
      });

      await prisma.liveCallSlot.create({
        data: {
          connectionId: unresolved.id,
          generation: unresolved.generation,
          userId: unknown.user.id,
        },
      });

      mockLiveCallAdminSession(admin.user);

      const cleanup =
        mode === "recovery"
          ? () => recoverLiveCalls({ limit: 1 })
          : () => closeAllLiveCalls({ limit: 1 });

      await expect(cleanup()).resolves.toMatchObject({ attempted: 1, closed: 0 });
      await expect(connection(unresolved.id)).resolves.toMatchObject({ state: "closing" });
      expect(closeLiveCallSession).not.toHaveBeenCalled();
      await expect(cleanup()).resolves.toMatchObject({ attempted: 1, closed: 1 });
      const knownRow = await connection(setup.connectionId);
      expect(knownRow).toMatchObject({ state: "closed" });
      expect(closeLiveCallSession).toHaveBeenCalledExactlyOnceWith(knownRow.providerSessionId);

      await expect(connection(unresolved.id)).resolves.toMatchObject({
        liabilityMicros: 135_000,
        providerSessionId: null,
        state: "closing",
      });

      await expect(
        prisma.liveCallSlot.findUnique({ where: { userId: unknown.user.id } }),
      ).resolves.toMatchObject({ connectionId: unresolved.id });
    },
  );

  it("refunds the original free-spend day when an unredeemed call closes after midnight", async () => {
    vi.setSystemTime(new Date("2450-04-08T23:59:50Z"));
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    const original = await connection(setup.connectionId);
    const nextDay = new Date("2450-04-09T00:00:00Z");
    await prisma.freeCallSpendDay.create({ data: { day: nextDay, spentMicros: 777 } });
    vi.setSystemTime(new Date("2450-04-09T00:01:00Z"));

    await expect(
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: original.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 0 });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: nextDay } }),
    ).resolves.toMatchObject({ spentMicros: 777 });
  });

  it("settles confirmed provider cost on the original free-spend day across midnight", async () => {
    vi.setSystemTime(new Date("2450-04-10T23:59:50Z"));
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    const original = await connection(setup.connectionId);
    const nextDay = new Date("2450-04-11T00:00:00Z");
    await prisma.freeCallSpendDay.create({ data: { day: nextDay, spentMicros: 999 } });
    vi.setSystemTime(new Date("2450-04-11T00:00:20Z"));

    await expect(
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: original.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 35_000 });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: nextDay } }),
    ).resolves.toMatchObject({ spentMicros: 999 });
  });

  it("marks exhausted recovery unconfirmed without releasing liability or the learner slot", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("Provider offline"));

    await closeLiveCallConnection({
      connectionId: setup.connectionId,
      generation: setup.generation,
    });

    await markLiveCallRecoveryUnconfirmed({
      connectionId: setup.connectionId,
      generation: setup.generation,
    });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costConfidence: "unconfirmed",
      liabilityMicros: 135_000,
      recoveryUnconfirmedAt: expect.any(Date),
      state: "closing",
    });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: setup.connectionId });
  });

  it("accrues unresolved provider liability beyond the intended deadline instead of capping cost", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    vi.setSystemTime(new Date(Date.now() + 600_000));
    vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("No terminal evidence"));

    await expect(
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closing" });

    const unresolved = await connection(setup.connectionId);

    expect(unresolved).toMatchObject({
      liabilityMicros: 510_000,
      settledMicros: 0,
      state: "closing",
    });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: unresolved.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 510_000 });

    vi.mocked(closeLiveCallSession).mockResolvedValue({
      reason: "closed",
      seconds: 600,
      status: "closed",
    });

    await expect(
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 510_000, seconds: 120 });
  });

  it("keeps calls open while one learner's connection is stuck and pauses them once several learners' are", async () => {
    const [open, paused, first, second, third] = await Promise.all([
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
    ]);

    await stuckConnection(first);
    mockSession(open.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: open.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await Promise.all([stuckConnection(second), stuckConnection(third)]);
    mockSession(paused.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: paused.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    await expect(
      usage({ conversationId: paused.conversation.id, userId: paused.user.id }),
    ).resolves.toBeNull();
  });

  it("settles a provider session no close can confirm at its longest possible run, and it stops pausing calls", async () => {
    const [stuck, second, third, learner, admin] = await Promise.all([
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture({ role: "admin" }),
    ]);

    mockSession(stuck.user.id);
    const setup = await reserve(stuck.conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: stuck.conversation.id });
    const startedAt = Date.now();
    vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("Sideband attach failed"));

    await expect(
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closing" });

    await Promise.all(
      [second, third].map(({ conversation, user }) =>
        liveCallHistoryFixture({
          closedAt: null,
          conversationId: conversation.id,
          deadlineAt: new Date(setup.deadlineAt),
          liabilityMicros: 135_000,
          providerSessionId: `live_${randomUUID()}`,
          providerStartedAt: new Date(startedAt),
          state: "closing",
          userId: user.id,
        }),
      ),
    );

    vi.setSystemTime(new Date(new Date(setup.deadlineAt).getTime() + 301_000));
    mockSession(learner.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: learner.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    vi.setSystemTime(new Date(startedAt + SESSION_SETTLED_MS + 1000));

    await expect(
      connectLanguageConversation({
        conversationId: learner.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });

    vi.mocked(closeLiveCallSession).mockClear();
    await recoverLiveCalls();

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costConfidence: "estimated",
      liabilityMicros: 0,
      settledMicros: LONGEST_SESSION_MICROS,
      state: "closed",
    });

    expect(closeLiveCallSession).not.toHaveBeenCalled();

    await expect(
      usage({ conversationId: stuck.conversation.id, userId: stuck.user.id }),
    ).resolves.toMatchObject({ costMicros: LONGEST_SESSION_MICROS, seconds: 120 });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: stuck.user.id } }),
    ).resolves.toMatchObject({ connectionId: null });

    mockLiveCallAdminSession(admin.user);
    const admission = await getLiveCallAdmission();

    if (admission.status !== "ready") {
      throw new Error("Admin admission read was not authorized");
    }

    expect(admission.connections).toContainEqual(
      expect.objectContaining({
        cleanupBlocking: false,
        costConfidence: "estimated",
        id: setup.connectionId,
        settledMicros: LONGEST_SESSION_MICROS,
        state: "closed",
      }),
    );
  });

  it("counts unsettled calls' unposted cost against the shared free day once they stop pausing calls", async () => {
    const [first, second, third, free, plus] = await Promise.all([
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture({ plus: true }),
    ]);

    const startedAt = Date.now();
    vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("Sideband attach failed"));

    for (const stuck of [first, second, third]) {
      mockSession(stuck.user.id);
      // oxlint-disable-next-line no-await-in-loop -- Each learner's call starts and fails to close in turn.
      const setup = await reserve(stuck.conversation.id);
      // oxlint-disable-next-line no-await-in-loop -- Redemption follows its own reservation.
      await redeem({ connectionId: setup.connectionId, conversationId: stuck.conversation.id });

      // oxlint-disable-next-line no-await-in-loop -- The failed close posts the reservation's liability.
      await closeLiveCallConnection({
        connectionId: setup.connectionId,
        generation: setup.generation,
      });
    }

    await prisma.liveCallSetting.update({
      data: { freeDailyBudgetMicros: 5_000_000 },
      where: { id: "live" },
    });

    vi.setSystemTime(new Date(startedAt + SESSION_SETTLED_MS + 1000));
    mockSession(free.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: free.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ limit: { period: "day" }, status: "limitReached" });

    mockSession(plus.user.id);

    await expect(
      connectLanguageConversation({
        conversationId: plus.conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("replaces an estimate with the provider's receipt exactly once when a close confirms after the sweep settled it", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    const startedAt = Date.now();
    const closeStarted = Promise.withResolvers<boolean>();
    const receipt = Promise.withResolvers<{ reason: string; seconds: number; status: "closed" }>();

    vi.mocked(closeLiveCallSession).mockImplementationOnce(() => {
      closeStarted.resolve(true);
      return receipt.promise;
    });

    vi.setSystemTime(new Date(startedAt + SESSION_SETTLED_MS - 10_000));

    const ending = closeLiveCallConnection({
      connectionId: setup.connectionId,
      generation: setup.generation,
      reason: "completion",
    });

    await closeStarted.promise;
    vi.setSystemTime(new Date(startedAt + SESSION_SETTLED_MS + 1000));

    await expect(
      recoverLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costConfidence: "estimated",
      settledMicros: LONGEST_SESSION_MICROS,
      state: "closed",
    });

    receipt.resolve({ reason: "expired", seconds: 3000, status: "closed" });
    await expect(ending).resolves.toStrictEqual({ status: "closed" });
    const reconciled = await connection(setup.connectionId);

    expect(reconciled).toMatchObject({
      costConfidence: "confirmed",
      liabilityMicros: 0,
      settledMicros: 2_510_000,
      state: "closed",
    });

    await expect(
      closeLiveCallConnection({ connectionId: setup.connectionId, generation: setup.generation }),
    ).resolves.toStrictEqual({ status: "closed" });

    expect(closeLiveCallSession).toHaveBeenCalledOnce();

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: reconciled.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: 2_510_000 });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 2_510_000, seconds: 120 });
  });

  it("settles an unconfirmable provider session once when the sweep and the learner's end race past its longest run", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const setup = await reserve(conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: conversation.id });
    const startedAt = Date.now();
    vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("Sideband attach failed"));
    vi.setSystemTime(new Date(startedAt + SESSION_SETTLED_MS + 1000));

    await expect(
      Promise.all([
        recoverLiveCallConnection({
          connectionId: setup.connectionId,
          generation: setup.generation,
        }),
        closeLiveCallConnection({
          connectionId: setup.connectionId,
          generation: setup.generation,
          reason: "completion",
        }),
      ]),
    ).resolves.toStrictEqual([{ status: "closed" }, { status: "closed" }]);

    const settled = await connection(setup.connectionId);

    expect(settled).toMatchObject({
      costConfidence: "estimated",
      settledMicros: LONGEST_SESSION_MICROS,
      state: "closed",
    });

    await expect(
      prisma.freeCallSpendDay.findUnique({ where: { day: settled.freeSpendDay! } }),
    ).resolves.toMatchObject({ spentMicros: LONGEST_SESSION_MICROS });

    await expect(
      usage({ conversationId: conversation.id, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: LONGEST_SESSION_MICROS, seconds: 120 });

    expect(closeLiveCallSession).not.toHaveBeenCalled();
  });

  it("takes over another call only after its server-confirmed close", async () => {
    const { conversation, user } = await liveCallFixture({ plus: true });
    const other = await anotherLiveConversation({ userId: user.id });
    mockSession(user.id);
    const first = await reserve(conversation.id);
    await redeem({ connectionId: first.connectionId, conversationId: conversation.id });
    vi.mocked(closeLiveCallSession).mockRejectedValueOnce(new Error("Cannot confirm close"));

    await expect(
      connectLanguageConversation({
        conversationId: other.id,
        input: { takeover: true },
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

    await expect(usage({ conversationId: other.id, userId: user.id })).resolves.toBeNull();

    vi.mocked(closeLiveCallSession).mockResolvedValue({
      reason: "closed",
      seconds: 30,
      status: "closed",
    });

    const takenOver = await connectLanguageConversation({
      conversationId: other.id,
      input: { takeover: true },
      scheduleDeadline: deadlineScheduler(),
    });

    expect(takenOver).toMatchObject({ status: "ready" });

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      endReason: "takeover",
      state: "closed",
    });

    await expect(
      completeLanguageConversation({
        conversationId: conversation.id,
        input: {
          connectionId: first.connectionId,
          spokenSeconds: 30,
          turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
          usedHelp: false,
        },
      }),
    ).resolves.toStrictEqual({ status: "takenOver" });

    expect(writeConversationFeedback).not.toHaveBeenCalled();
    expect(checkConversationObjectives).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.findUnique({ where: { id: conversation.id } }),
    ).resolves.toMatchObject({ feedback: null, status: "ready" });
  });

  it("preserves takeover semantics after an earlier same-call reconnect failed to close", async () => {
    const { conversation, user } = await liveCallFixture({ plus: true });
    const other = await anotherLiveConversation({ userId: user.id });
    mockSession(user.id);
    const first = await reserve(conversation.id);
    await redeem({ connectionId: first.connectionId, conversationId: conversation.id });
    vi.mocked(closeLiveCallSession).mockRejectedValueOnce(new Error("Reconnect close timed out"));

    await expect(
      connectLanguageConversation({
        conversationId: conversation.id,
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      endReason: "reconnect",
      state: "closing",
    });

    await expect(
      connectLanguageConversation({
        conversationId: other.id,
        input: { takeover: true },
        scheduleDeadline: deadlineScheduler(),
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      endReason: "takeover",
      state: "closed",
    });

    await expect(
      completeLanguageConversation({
        conversationId: conversation.id,
        input: {
          connectionId: first.connectionId,
          spokenSeconds: 30,
          turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
          usedHelp: false,
        },
      }),
    ).resolves.toStrictEqual({ status: "takenOver" });

    expect(writeConversationFeedback).not.toHaveBeenCalled();
    expect(checkConversationObjectives).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.findUnique({ where: { id: conversation.id } }),
    ).resolves.toMatchObject({ feedback: null, status: "ready" });
  });

  it.each(["takeover", "admin"])(
    "rereads the persisted %s reason after completion's delayed provider close",
    async (reason) => {
      const [learner, admin] = await Promise.all([
        liveCallFixture({ plus: true }),
        liveCallFixture({ role: "admin" }),
      ]);

      const other = await anotherLiveConversation({ userId: learner.user.id });
      mockSession(learner.user.id);
      const setup = await reserve(learner.conversation.id);
      await redeem({ connectionId: setup.connectionId, conversationId: learner.conversation.id });
      const firstCloseStarted = Promise.withResolvers<boolean>();
      const firstClose = Promise.withResolvers<Awaited<ReturnType<typeof closeLiveCallSession>>>();

      vi.mocked(closeLiveCallSession).mockImplementationOnce(() => {
        firstCloseStarted.resolve(true);
        return firstClose.promise;
      });

      const completing = completeLanguageConversation({
        conversationId: learner.conversation.id,
        input: {
          connectionId: setup.connectionId,
          spokenSeconds: 30,
          turns: [{ speaker: "learner", text: "Can I see it on Saturday?" }],
          usedHelp: false,
        },
      });

      await firstCloseStarted.promise;

      try {
        await expect(connection(setup.connectionId)).resolves.toMatchObject({
          endReason: "completion",
          state: "closing",
        });

        if (reason === "admin") {
          mockLiveCallAdminSession(admin.user);
        }

        const cancellation =
          reason === "takeover"
            ? await connectLanguageConversation({
                conversationId: other.id,
                input: { takeover: true },
                scheduleDeadline: deadlineScheduler(),
              })
            : await closeAllLiveCalls({ limit: 1 });

        expect(cancellation).toMatchObject({ status: "ready" });

        await expect(connection(setup.connectionId)).resolves.toMatchObject({
          endReason: reason,
          state: "closed",
        });
      } finally {
        firstClose.resolve({ reason: "closed", seconds: 30, status: "closed" });
      }

      await expect(completing).resolves.toStrictEqual({
        status: reason === "takeover" ? "takenOver" : "conversationEnded",
      });

      expect(writeConversationFeedback).not.toHaveBeenCalled();
      expect(checkConversationObjectives).not.toHaveBeenCalled();

      await expect(
        prisma.languageConversation.findUnique({ where: { id: learner.conversation.id } }),
      ).resolves.toMatchObject({ feedback: null, status: "ready" });
    },
  );

  it("authorizes admin admission and close-all inside core", async () => {
    const { user } = await liveCallFixture();
    mockSession(null);
    await expect(getLiveCallAdmission()).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(updateLiveCallAdmission(SETTINGS)).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await expect(closeAllLiveCalls({})).resolves.toStrictEqual({ status: "unauthorized" });
    mockSession(user.id);

    await expect(
      updateLiveCallAdmission({ admission: "off", freeDailyBudgetMicros: 0 }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    await expect(closeAllLiveCalls({})).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      prisma.liveCallSetting.findUnique({ where: { id: "live" } }),
    ).resolves.toMatchObject(SETTINGS);
  });

  it("reports overdue reservations separately from cleanup-blocking provider states", async () => {
    const [admin, future, pending, creating, closing, active] = await Promise.all([
      liveCallFixture({ role: "admin" }),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
      liveCallFixture(),
    ]);

    const [futureRow, pendingRow] = await Promise.all([
      liveCallHistoryFixture({
        closedAt: null,
        conversationId: future.conversation.id,
        deadlineAt: new Date(Date.now() + 1000),
        state: "active",
        userId: future.user.id,
      }),
      liveCallHistoryFixture({
        closedAt: null,
        conversationId: pending.conversation.id,
        deadlineAt: new Date(Date.now() - 400_000),
        state: "pending",
        userId: pending.user.id,
      }),
    ]);

    mockLiveCallAdminSession(admin.user);

    await expect(getLiveCallAdmission()).resolves.toMatchObject({
      cleanupHealthy: true,
      connections: expect.arrayContaining([
        expect.objectContaining({ cleanupBlocking: false, id: futureRow.id, overdue: false }),
        expect.objectContaining({ cleanupBlocking: false, id: pendingRow.id, overdue: true }),
      ]),
      status: "ready",
    });

    const blockingRows = await Promise.all([
      liveCallHistoryFixture({
        closedAt: null,
        conversationId: creating.conversation.id,
        deadlineAt: new Date(Date.now() - 301_000),
        state: "creating",
        userId: creating.user.id,
      }),
      liveCallHistoryFixture({
        closedAt: null,
        conversationId: closing.conversation.id,
        deadlineAt: new Date(Date.now() - 302_000),
        state: "closing",
        userId: closing.user.id,
      }),
      liveCallHistoryFixture({
        closedAt: null,
        conversationId: active.conversation.id,
        deadlineAt: new Date(Date.now() - 303_000),
        state: "active",
        userId: active.user.id,
      }),
    ]);

    const unhealthy = await getLiveCallAdmission();
    expect(unhealthy).toMatchObject({ cleanupHealthy: false, status: "ready" });

    if (unhealthy.status !== "ready") {
      throw new Error("Admin cleanup-health read was not authorized");
    }

    blockingRows.forEach(({ id }) => {
      expect(unhealthy.connections).toContainEqual(
        expect.objectContaining({ cleanupBlocking: true, id, overdue: true }),
      );
    });
  });

  it("reports globally unhealthy cleanup even when the stuck provider rows are beyond the bounded admin list", async () => {
    const [admin, stuck, pending] = await Promise.all([
      liveCallFixture({ role: "admin" }),
      Promise.all(Array.from({ length: 3 }, () => liveCallFixture())),
      Promise.all(Array.from({ length: 100 }, () => liveCallFixture())),
    ]);

    await Promise.all(
      pending.map(({ conversation, user }) =>
        liveCallHistoryFixture({
          closedAt: null,
          conversationId: conversation.id,
          deadlineAt: new Date(Date.now() - 600_000),
          state: "pending",
          userId: user.id,
        }),
      ),
    );

    const blocked = await Promise.all(stuck.map((fixture) => stuckConnection(fixture)));

    mockLiveCallAdminSession(admin.user);
    const result = await getLiveCallAdmission();
    expect(result).toMatchObject({ cleanupHealthy: false, status: "ready" });

    if (result.status !== "ready") {
      throw new Error("Admin cleanup-health read was not authorized");
    }

    expect(result.connections).toHaveLength(100);

    blocked.forEach(({ id }) => {
      expect(result.connections).not.toContainEqual(expect.objectContaining({ id }));
    });

    expect(result.connections).not.toContainEqual(
      expect.objectContaining({ cleanupBlocking: true }),
    );
  });

  it("turns admission off before an admin shutdown reaches the provider, retaining unresolved slots", async () => {
    const [learner, admin] = await Promise.all([
      liveCallFixture(),
      liveCallFixture({ role: "admin" }),
    ]);

    mockSession(learner.user.id);
    const setup = await reserve(learner.conversation.id);
    await redeem({ connectionId: setup.connectionId, conversationId: learner.conversation.id });
    mockLiveCallAdminSession(admin.user);

    vi.mocked(closeLiveCallSession).mockImplementation(async () => {
      await expect(
        prisma.liveCallSetting.findUnique({ where: { id: "live" } }),
      ).resolves.toMatchObject({ admission: "off" });

      throw new Error("Close receipt unavailable");
    });

    await expect(closeAllLiveCalls({ limit: 1 })).resolves.toMatchObject({ status: "ready" });
    expect(closeLiveCallSession).toHaveBeenCalledOnce();
    await expect(connection(setup.connectionId)).resolves.toMatchObject({ state: "closing" });

    await expect(
      prisma.liveCallSlot.findUnique({ where: { userId: learner.user.id } }),
    ).resolves.toMatchObject({ connectionId: setup.connectionId });

    await expect(getLiveCallAdmission()).resolves.toMatchObject({ status: "ready" });

    await expect(
      updateLiveCallAdmission({ admission: "staff", freeDailyBudgetMicros: 25_000 }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.liveCallSetting.findUnique({ where: { id: "live" } }),
    ).resolves.toMatchObject({ admission: "staff", freeDailyBudgetMicros: 25_000 });
  });
});
