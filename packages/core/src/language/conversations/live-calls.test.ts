import { checkConversationObjectives } from "@zoonk/ai/tasks/language/conversation-objectives";
import { LiveCallCreationRefusedError } from "@zoonk/ai/tasks/language/live-call-creation";
import {
  type LiveCallSession,
  createLiveCallSession,
  hangUpLiveCallSession,
  isLiveCallAvailable,
} from "@zoonk/ai/tasks/language/live-call-session";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import {
  LIVE_CALL_WRAP_UP_SECONDS,
  getCallMonthlyBudgetMicros,
  getDailySpendBudgetMicros,
  getLiveCallCostMicros,
  getLiveCallReservationMicros,
} from "../../entitlements/limits";
import {
  anotherLiveConversation,
  liveCallFixture,
  liveCallHistoryFixture,
} from "./_test-utils/live-call-fixture";
import { getCallExposureMicros } from "./_utils/live-call-money";
import { checkLanguageConversationObjectives } from "./check-language-conversation-objectives";
import { connectLanguageConversation } from "./connect-language-conversation";
import { type LanguageConversationSetup } from "./conversation-contract";
import { endLanguageConversationConnection } from "./end-language-conversation-connection";
import { endLiveCall } from "./end-live-call";
import { redeemLiveCallSdp } from "./redeem-live-call-sdp";
import { startLanguageConversation } from "./start-language-conversation";

const SECOND_MS = 1000;
const TWO_MINUTES = 120;
const WRAP_UP = LIVE_CALL_WRAP_UP_SECONDS;
const DAY_SECONDS = 24 * 60 * 60;
const LONGEST_SESSION_SECONDS = 2 * 60 * 60 + 60;
const UNCONFIRMED_CLEANUP_SECONDS = 30;

function advance(seconds: number) {
  vi.setSystemTime(new Date(Date.now() + seconds * SECOND_MS));
}

async function learner(options: Parameters<typeof liveCallFixture>[0] = {}) {
  const fixture = await liveCallFixture({ minutes: 2, ...options });
  mockSession(fixture.user.id);
  return fixture;
}

function reserve(conversationId: string, input?: { takeover?: boolean }) {
  return connectLanguageConversation({ conversationId, input, scheduleDeadline: async () => null });
}

async function reserved(conversationId: string): Promise<LanguageConversationSetup> {
  const result = await reserve(conversationId);

  if (result.status !== "ready") {
    throw new Error(`Expected a reservation, got ${result.status}`);
  }

  return result.setup;
}

function offer({ connectionId }: LanguageConversationSetup, conversationId: string) {
  return redeemLiveCallSdp({ connectionId, conversationId, input: { sdp: "test-offer" } });
}

async function live(conversationId: string): Promise<LanguageConversationSetup> {
  const setup = await reserved(conversationId);
  await expect(offer(setup, conversationId)).resolves.toMatchObject({ status: "ready" });
  return setup;
}

function connection(id: string) {
  return prisma.liveCallConnection.findUniqueOrThrow({ where: { id } });
}

function usage({ connectionId, userId }: { connectionId: string; userId: string }) {
  return prisma.usageRecord.findUniqueOrThrow({
    where: { userUsageTarget: { kind: "conversation", targetId: connectionId, userId } },
  });
}

function noObjectivesMet() {
  vi.mocked(checkConversationObjectives).mockResolvedValueOnce({
    data: { goodbye: false, met: [] },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "v-test",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: "run-test",
      usage: {},
    },
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  });
}

/** Connects, talks through the talk time and its wrap-up, and lets the deadline hang up. */
async function runWholeCall(conversationId: string): Promise<LanguageConversationSetup> {
  const setup = await live(conversationId);
  advance(setup.seconds);
  await endLiveCall({ connectionId: setup.connectionId, reason: "deadline" });
  return setup;
}

async function callSecondsUsed(userId: string): Promise<number | null> {
  const { _sum } = await prisma.usageRecord.aggregate({
    _sum: { seconds: true },
    where: { kind: "conversation", userId },
  });

  return _sum.seconds;
}

async function costMicrosSpent(userId: string): Promise<number | null> {
  const { _sum } = await prisma.usageRecord.aggregate({
    _sum: { costMicros: true },
    where: { userId },
  });

  return _sum.costMicros;
}

/** What OpenAI's hangup has answered for sessions it had already closed. */
function unconfirmedHangUp() {
  vi.mocked(hangUpLiveCallSession).mockRejectedValueOnce(
    new Error("The provider didn't hang up the Live session (503)"),
  );
}

function pendingCreation() {
  const creation = Promise.withResolvers<LiveCallSession>();
  vi.mocked(createLiveCallSession).mockReturnValueOnce(creation.promise);
  return creation;
}

describe("live calls", () => {
  beforeEach(async () => {
    freezeClock();
    vi.setSystemTime(new Date("2031-01-02T12:00:00Z"));
    vi.mocked(isLiveCallAvailable).mockReturnValue(true);
    vi.mocked(hangUpLiveCallSession).mockReset();

    vi.mocked(createLiveCallSession)
      .mockReset()
      .mockImplementation(async () => ({
        sdp: "test-answer",
        sessionId: `session-${crypto.randomUUID()}`,
      }));
  });

  it("[1] admits a whole call while any of today's call time is left, with a wrap-up it never counts, and refuses the next one", async () => {
    const { conversation, user } = await learner();
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 80, userId: user.id });

    const setup = await live(conversation.id);
    const row = await connection(setup.connectionId);

    expect(setup).toMatchObject({ seconds: TWO_MINUTES + WRAP_UP, talkSeconds: TWO_MINUTES });
    expect(row.heldSeconds).toBe(TWO_MINUTES);

    expect(row.deadlineAt.getTime() - row.createdAt.getTime()).toBe(
      (TWO_MINUTES + WRAP_UP) * SECOND_MS,
    );

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({
      costMicros: getLiveCallReservationMicros(TWO_MINUTES),
      seconds: TWO_MINUTES,
    });

    advance(TWO_MINUTES + WRAP_UP);
    await endLiveCall({ connectionId: setup.connectionId, reason: "deadline" });

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      limit: { limit: TWO_MINUTES, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });

    await expect(callSecondsUsed(user.id)).resolves.toBe(80 + TWO_MINUTES);
    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(1);
    expect(createLiveCallSession).toHaveBeenCalledOnce();
  });

  it("[1] refuses a free learner a practice length that comes with Plus, without a session", async () => {
    const { conversation, user } = await learner({ minutes: 5 });

    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "plusRequired" });
    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(0);
    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("[1] lets a learner at the limit finish a dropped call: the reconnect holds what's left of its talk window, then the next start is refused", async () => {
    const { conversation, user } = await learner();
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 80, userId: user.id });
    const first = await live(conversation.id);

    advance(47);
    const second = await live(conversation.id);

    expect(second).toMatchObject({
      seconds: TWO_MINUTES - 47 + WRAP_UP,
      talkSeconds: TWO_MINUTES - 47,
    });

    await expect(
      usage({ connectionId: second.connectionId, userId: user.id }),
    ).resolves.toMatchObject({
      costMicros: getLiveCallReservationMicros(TWO_MINUTES - 47),
      seconds: TWO_MINUTES - 47,
    });

    advance(second.seconds);
    await endLiveCall({ connectionId: second.connectionId, reason: "deadline" });

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      limit: { limit: TWO_MINUTES, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });

    await expect(callSecondsUsed(user.id)).resolves.toBe(80 + TWO_MINUTES);
    expect(first.connectionId).not.toBe(second.connectionId);
  });

  it("[1] gives a practice reconnect only what's left of its talk window, and a whole call once that's over", async () => {
    const { conversation } = await learner({ plus: true });
    await live(conversation.id);

    advance(30);
    const reconnected = await live(conversation.id);
    advance(TWO_MINUTES - 30 + 1);
    const restarted = await reserved(conversation.id);

    expect([reconnected, restarted]).toMatchObject([
      { talkSeconds: TWO_MINUTES - 30 },
      { talkSeconds: TWO_MINUTES },
    ]);
  });

  it("[1] keeps a checkpoint's first talk time on every reconnect, each with its own wrap-up, until that time is over", async () => {
    const { conversation } = await learner({ kind: "checkpoint", plus: true });
    const first = await live(conversation.id);

    advance(50);
    const second = await live(conversation.id);
    advance(40);
    const third = await reserved(conversation.id);

    expect([second, third]).toMatchObject([
      { seconds: TWO_MINUTES - 50 + WRAP_UP, talkSeconds: TWO_MINUTES - 50 },
      { seconds: TWO_MINUTES - 90 + WRAP_UP, talkSeconds: TWO_MINUTES - 90 },
    ]);

    expect(third.deadlineAt).toBe(first.deadlineAt);

    advance(30);

    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "conversationEnded" });
  });

  it("[1] hangs up at the deadline after the wrap-up and charges the learner only the talk time, even when the hangup confirms late", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);
    const { providerSessionId } = await connection(setup.connectionId);

    advance(TWO_MINUTES + WRAP_UP);

    vi.mocked(hangUpLiveCallSession).mockImplementationOnce(async () => {
      advance(20);
      return "hungUp";
    });

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    expect(hangUpLiveCallSession).toHaveBeenCalledExactlyOnceWith(providerSessionId);

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(TWO_MINUTES + WRAP_UP + 20),
      endReason: "deadline",
      endUnconfirmed: false,
      state: "ended",
    });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(TWO_MINUTES + WRAP_UP + 20),
      seconds: TWO_MINUTES,
    });
  });

  it("[1] charges a call that connected late only the part of its talk time it was live, when it ends in the wrap-up", async () => {
    const { conversation, user } = await learner();
    const setup = await reserved(conversation.id);

    advance(10);
    await expect(offer(setup, conversation.id)).resolves.toMatchObject({ status: "ready" });
    advance(TWO_MINUTES);

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "learner" }),
    ).resolves.toStrictEqual({ status: "ended" });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(TWO_MINUTES),
      seconds: TWO_MINUTES - 10,
    });
  });

  it("[1] keeps only the talk time when a session that ended on its own was last active in the wrap-up", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);

    advance(TWO_MINUTES + 10);
    noObjectivesMet();

    await expect(
      checkLanguageConversationObjectives({
        conversationId: conversation.id,
        input: { turns: [{ speaker: "learner", text: "Bye!" }] },
      }),
    ).resolves.toMatchObject({ status: "ready" });

    advance(20);
    vi.mocked(hangUpLiveCallSession).mockResolvedValueOnce("alreadyEnded");

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ seconds: TWO_MINUTES });
  });

  it("[1] admits a whole call while any of the day's AI budget is left, and refuses the next one once that call spent it", async () => {
    const { conversation, user } = await learner({ plus: true });
    const budget = getDailySpendBudgetMicros("plus");

    await usageRecordsFixture({
      costMicros: budget - 1,
      count: 1,
      kind: "explanation",
      userId: user.id,
    });

    await runWholeCall(conversation.id);

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      limit: { limit: budget, period: "day", resource: "aiSpend", tier: "plus" },
      status: "limitReached",
    });

    await expect(costMicrosSpent(user.id)).resolves.toBe(
      budget - 1 + getLiveCallCostMicros(TWO_MINUTES + WRAP_UP),
    );
  });

  it("[1] admits a whole call while any of the month's call budget is left, and refuses the next one once that call spent it", async () => {
    const { conversation, user } = await learner({ plus: true });
    const budget = getCallMonthlyBudgetMicros("plus");

    await liveCallHistoryFixture({
      conversationId: conversation.id,
      costMicros: budget - 1,
      userId: user.id,
    });

    await runWholeCall(conversation.id);

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      limit: { limit: budget, period: "month", resource: "aiSpend", tier: "plus" },
      status: "limitReached",
    });

    await expect(
      prisma.liveCallConnection.aggregate({
        _sum: { costMicros: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual({
      _sum: { costMicros: budget - 1 + getLiveCallCostMicros(TWO_MINUTES + WRAP_UP) },
    });
  });

  it("[1] admits a free month's two 2-minute calls run to their hard stop, a whole third with a minute left, and no fourth", async () => {
    const { conversation, user } = await learner();

    await runWholeCall(conversation.id);
    advance(DAY_SECONDS);
    await runWholeCall(conversation.id);
    advance(DAY_SECONDS);

    await expect(
      prisma.usageRecord.findMany({
        orderBy: { createdAt: "asc" },
        where: { kind: "conversation", userId: user.id },
      }),
    ).resolves.toMatchObject([
      { costMicros: getLiveCallCostMicros(TWO_MINUTES + WRAP_UP), seconds: TWO_MINUTES },
      { costMicros: getLiveCallCostMicros(TWO_MINUTES + WRAP_UP), seconds: TWO_MINUTES },
    ]);

    await expect(runWholeCall(conversation.id)).resolves.toMatchObject({
      talkSeconds: TWO_MINUTES,
    });

    advance(DAY_SECONDS);

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      limit: { limit: 5 * 60, period: "month", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });

    await expect(callSecondsUsed(user.id)).resolves.toBe(3 * TWO_MINUTES);
  });

  it("[1] keeps none of the learner's time when the app left before the call was used and OpenAI already ended its session", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);

    advance(TWO_MINUTES);
    vi.mocked(hangUpLiveCallSession).mockResolvedValueOnce("alreadyEnded");

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    // Its cost still counts the clock: nothing says when OpenAI stopped billing.
    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: getLiveCallCostMicros(TWO_MINUTES), seconds: 0 });
  });

  it("[1] keeps the learner's time up to the call's last check when its session ended on its own", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);

    advance(30);
    noObjectivesMet();

    await expect(
      checkLanguageConversationObjectives({
        conversationId: conversation.id,
        input: { turns: [{ speaker: "learner", text: "Is it available?" }] },
      }),
    ).resolves.toMatchObject({ status: "ready" });

    advance(60);
    vi.mocked(hangUpLiveCallSession).mockResolvedValueOnce("alreadyEnded");
    await reserved(conversation.id);

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(90),
      endReason: "reconnect",
      state: "ended",
    });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ seconds: 30 });
  });

  it("[2] gives two tabs reserving at once one open connection and one hold", async () => {
    const { conversation, user } = await learner();

    const answers = await Promise.all([reserve(conversation.id), reserve(conversation.id)]);

    expect(answers.filter((answer) => answer.status === "ready").length).toBeGreaterThan(0);

    const [open, held] = await Promise.all([
      prisma.liveCallConnection.findMany({ where: { state: { not: "ended" }, userId: user.id } }),
      prisma.usageRecord.aggregate({
        _sum: { costMicros: true, seconds: true },
        where: { kind: "conversation", userId: user.id },
      }),
    ]);

    expect(open).toHaveLength(1);

    expect(held._sum).toStrictEqual({
      costMicros: getLiveCallReservationMicros(TWO_MINUTES),
      seconds: TWO_MINUTES,
    });
  });

  it("[2] creates one provider session for two offers on one reservation", async () => {
    const { conversation } = await learner();
    const setup = await reserved(conversation.id);

    const answers = await Promise.all([
      offer(setup, conversation.id),
      offer(setup, conversation.id),
    ]);

    expect(answers.map((answer) => answer.status).toSorted()).toStrictEqual([
      "connectionUsed",
      "ready",
    ]);

    expect(createLiveCallSession).toHaveBeenCalledOnce();
  });

  it("[2] settles once when the learner's End and the deadline race", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);

    advance(60);

    await Promise.all([
      endLanguageConversationConnection({
        connectionId: setup.connectionId,
        conversationId: conversation.id,
      }),
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ]);

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: getLiveCallCostMicros(60), seconds: 60 });
  });

  it("[2] makes a start wait while a creation is in flight, then hangs that session up once it exists", async () => {
    const { conversation, user } = await learner();
    const setup = await reserved(conversation.id);
    const creation = pendingCreation();
    const offered = offer(setup, conversation.id);

    await vi.waitFor(() => expect(createLiveCallSession).toHaveBeenCalledOnce());

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      status: "previousConnectionClosing",
    });

    advance(3);
    creation.resolve({ sdp: "late-answer", sessionId: "session-late" });

    await expect(offered).resolves.toStrictEqual({ status: "previousConnectionClosing" });
    expect(hangUpLiveCallSession).toHaveBeenCalledExactlyOnceWith("session-late");

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(3),
      endReason: "reconnect",
      providerSessionId: "session-late",
      state: "ended",
    });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ seconds: 0 });

    await expect(reserve(conversation.id)).resolves.toMatchObject({ status: "ready" });
  });

  it("[2] honors an End during a creation the moment the session exists", async () => {
    const { conversation } = await learner();
    const setup = await reserved(conversation.id);
    const creation = pendingCreation();
    const offered = offer(setup, conversation.id);

    await vi.waitFor(() => expect(createLiveCallSession).toHaveBeenCalledOnce());

    await expect(
      endLanguageConversationConnection({
        connectionId: setup.connectionId,
        conversationId: conversation.id,
      }),
    ).resolves.toStrictEqual({ status: "previousConnectionClosing" });

    creation.resolve({ sdp: "late-answer", sessionId: "session-ended-early" });

    await expect(offered).resolves.toStrictEqual({ status: "previousConnectionClosing" });
    expect(hangUpLiveCallSession).toHaveBeenCalledExactlyOnceWith("session-ended-early");

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      endReason: "learner",
      state: "ended",
    });
  });

  it("[2] settles the old connection at the moment the learner connects again", async () => {
    const { conversation, user } = await learner({ minutes: 1 });
    const first = await live(conversation.id);

    advance(30);
    await reserved(conversation.id);

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(30),
      endReason: "reconnect",
      state: "ended",
    });

    await expect(
      usage({ connectionId: first.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ seconds: 30 });
  });

  it("[2] needs takeover to end the learner's call in another conversation", async () => {
    const { conversation, user } = await learner();
    const first = await live(conversation.id);
    const other = await anotherLiveConversation({ userId: user.id });

    await expect(reserve(other.id)).resolves.toStrictEqual({
      connectionId: first.connectionId,
      conversationId: conversation.id,
      status: "callInProgress",
    });

    await expect(reserve(other.id, { takeover: true })).resolves.toMatchObject({ status: "ready" });

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      endReason: "takeover",
      state: "ended",
    });
  });

  it("[2] connects the learner again after a hangup OpenAI didn't confirm, ending the old call unconfirmed at a bounded cost", async () => {
    const { conversation, user } = await learner();
    const first = await live(conversation.id);

    advance(30);
    unconfirmedHangUp();

    await expect(reserve(conversation.id)).resolves.toMatchObject({ status: "ready" });

    await expect(connection(first.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(30 + UNCONFIRMED_CLEANUP_SECONDS),
      endReason: "reconnect",
      endUnconfirmed: true,
      state: "ended",
    });

    await expect(
      usage({ connectionId: first.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ seconds: 30 });

    const other = await anotherLiveConversation({ userId: user.id });
    unconfirmedHangUp();

    await expect(reserve(other.id, { takeover: true })).resolves.toMatchObject({ status: "ready" });
  });

  it("[2] ends a call at its deadline when OpenAI doesn't confirm the hangup, without trying again", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);

    advance(setup.seconds);
    unconfirmedHangUp();

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    expect(hangUpLiveCallSession).toHaveBeenCalledOnce();

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(setup.seconds + UNCONFIRMED_CLEANUP_SECONDS),
      endUnconfirmed: true,
      state: "ended",
    });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ seconds: TWO_MINUTES });
  });

  it("[2] settles refused and unanswered creations", async () => {
    const { conversation, user } = await learner();

    const refused = await reserved(conversation.id);

    vi.mocked(createLiveCallSession).mockRejectedValueOnce(new LiveCallCreationRefusedError(429));

    await expect(offer(refused, conversation.id)).resolves.toStrictEqual({ status: "retryable" });

    await expect(connection(refused.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(0),
      endReason: "refused",
      state: "ended",
    });

    await expect(
      usage({ connectionId: refused.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: getLiveCallCostMicros(0), seconds: 0 });

    const unanswered = await reserved(conversation.id);

    vi.mocked(createLiveCallSession).mockImplementationOnce(async () => {
      advance(90);
      throw new Error("The creation request timed out");
    });

    await expect(offer(unanswered, conversation.id)).resolves.toStrictEqual({
      status: "retryable",
    });

    const held = getLiveCallReservationMicros(TWO_MINUTES);

    await expect(connection(unanswered.connectionId)).resolves.toMatchObject({
      costMicros: Math.max(held, getLiveCallCostMicros(90)),
      endReason: "failed",
      state: "ended",
    });
  });

  it("[2] keeps the day's connection cap", async () => {
    const { conversation, user } = await learner();

    await Promise.all(
      Array.from({ length: 30 }, () =>
        liveCallHistoryFixture({ conversationId: conversation.id, userId: user.id }),
      ),
    );

    await expect(reserve(conversation.id)).resolves.toStrictEqual({
      period: "day",
      status: "connectionLimitReached",
    });
  });

  it("[F3] counts a creation that never named its session at the larger of its reservation and the clock", async () => {
    const { conversation } = await learner();
    const setup = await reserved(conversation.id);
    const creation = pendingCreation();
    const offered = offer(setup, conversation.id);

    await vi.waitFor(() => expect(createLiveCallSession).toHaveBeenCalledOnce());
    advance(300);

    const { startedAt } = await connection(setup.connectionId);
    const clock = getLiveCallCostMicros(Math.ceil((Date.now() - Number(startedAt)) / SECOND_MS));

    expect(clock).toBeGreaterThan(getLiveCallReservationMicros(TWO_MINUTES));

    const starting = await connection(setup.connectionId);

    expect(starting.state).toBe("starting");
    expect(getCallExposureMicros({ connection: starting, now: new Date() })).toBe(clock);

    creation.reject(new Error("The creation request timed out"));
    await expect(offered).resolves.toStrictEqual({ status: "retryable" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: clock,
      state: "ended",
    });
  });

  it("[F6] refuses an offer past its reservation's connect window and ends that reservation at no cost on the next start", async () => {
    const { conversation, user } = await learner();
    const stale = await reserved(conversation.id);

    advance(61);

    await expect(offer(stale, conversation.id)).resolves.toStrictEqual({
      status: "connectionExpired",
    });

    await expect(reserve(conversation.id)).resolves.toMatchObject({
      setup: { talkSeconds: TWO_MINUTES },
      status: "ready",
    });

    await expect(connection(stale.connectionId)).resolves.toMatchObject({
      costMicros: 0,
      state: "ended",
    });

    await expect(
      usage({ connectionId: stale.connectionId, userId: user.id }),
    ).resolves.toMatchObject({ costMicros: 0, seconds: 0 });
  });

  it("[2] settles a call left open for a month at most a session's longest life", async () => {
    const { conversation } = await learner({ plus: true });
    const setup = await live(conversation.id);

    advance(31 * 24 * 60 * 60);

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "reconnect" }),
    ).resolves.toStrictEqual({ status: "ended" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(LONGEST_SESSION_SECONDS),
      state: "ended",
    });

    await expect(reserve(conversation.id)).resolves.toMatchObject({ status: "ready" });
  });

  it("[F7] settles a deleted learner's call at its deadline, keeping its cost on the connection", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);

    await prisma.user.delete({ where: { id: user.id } });
    advance(TWO_MINUTES);

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(TWO_MINUTES),
      state: "ended",
      userId: null,
    });
  });

  it("[1][2] settles a creation the server never finished, by estimate, at its deadline", async () => {
    const { conversation } = await learner();
    const setup = await reserved(conversation.id);
    pendingCreation();
    void offer(setup, conversation.id);

    await vi.waitFor(() => expect(createLiveCallSession).toHaveBeenCalledOnce());
    advance(TWO_MINUTES);

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallReservationMicros(TWO_MINUTES),
      endReason: "deadline",
      state: "ended",
    });

    expect(hangUpLiveCallSession).not.toHaveBeenCalled();
  });

  it("refuses a practice call's start while calls are paused, before writing it", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    vi.mocked(isLiveCallAvailable).mockReturnValue(false);

    await expect(
      startLanguageConversation({ chapterId: renting.id, kind: "practice", minutes: 2 }),
    ).resolves.toStrictEqual({ status: "callsPaused" });

    await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );
  });

  it("[4] pauses calls at Connect and at the SDP step without an OpenAI key", async () => {
    const { conversation } = await learner();
    const setup = await reserved(conversation.id);

    vi.mocked(isLiveCallAvailable).mockReturnValue(false);
    await expect(offer(setup, conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });
    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });
});
