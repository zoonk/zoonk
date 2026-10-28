import { LiveCallCreationRefusedError } from "@zoonk/ai/tasks/v2/language/live-call-creation";
import {
  type LiveCallSession,
  createLiveCallSession,
  hangUpLiveCallSession,
  isLiveCallAvailable,
} from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { getLiveCallCostMicros, getLiveCallReservationMicros } from "../../entitlements/limits";
import {
  anotherLiveConversation,
  liveCallFixture,
  liveCallHistoryFixture,
  mockLiveCallAdminSession,
} from "./_test-utils/live-call-fixture";
import { getCallExposureMicros } from "./_utils/live-call-money";
import { connectLanguageConversation } from "./connect-language-conversation";
import { type LanguageConversationSetup } from "./conversation-contract";
import { endLanguageConversationConnection } from "./end-language-conversation-connection";
import { endLiveCall } from "./end-live-call";
import { getLiveCallAdmission } from "./live-call-admission";
import { redeemLiveCallSdp } from "./redeem-live-call-sdp";

const DAY_MS = 86_400_000;
const SECOND_MS = 1000;
const BIG_BUDGET = 150_000_000;
const TWO_MINUTES = 120;
/** OpenAI's longest Live session (about 2 hours) and a creation's minute. */
const LONGEST_SESSION_SECONDS = 2 * 60 * 60 + 60;

/** Each test runs on a day of its own, so the free day's shared bucket is the test's alone. */
const FIRST_DAY = Date.parse("2031-01-01T12:00:00Z");
const testDay = { index: 0 };

function startOwnDay(time = "12:00:00") {
  testDay.index += 1;
  const day = new Date(FIRST_DAY + testDay.index * DAY_MS).toISOString().slice(0, 10);
  vi.setSystemTime(new Date(`${day}T${time}Z`));
}

function advance(seconds: number) {
  vi.setSystemTime(new Date(Date.now() + seconds * SECOND_MS));
}

function utcDay(date: Date) {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`);
}

async function setAdmission(
  admission: "off" | "staff" | "all",
  freeDailyBudgetMicros = BIG_BUDGET,
) {
  await prisma.liveCallSetting.upsert({
    create: { admission, freeDailyBudgetMicros, id: "live" },
    update: { admission, freeDailyBudgetMicros },
    where: { id: "live" },
  });
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

async function freeDaySpent(day: Date) {
  const bucket = await prisma.freeCallSpendDay.findUnique({ where: { day: utcDay(day) } });
  return bucket?.spentMicros ?? 0;
}

/** A creation request that answers only when the test says so. */
function pendingCreation() {
  const creation = Promise.withResolvers<LiveCallSession>();
  vi.mocked(createLiveCallSession).mockReturnValueOnce(creation.promise);
  return creation;
}

describe("live calls", () => {
  beforeEach(async () => {
    freezeClock();
    startOwnDay();
    await setAdmission("all");
    vi.mocked(isLiveCallAvailable).mockReturnValue(true);
    vi.mocked(hangUpLiveCallSession).mockReset();

    vi.mocked(createLiveCallSession)
      .mockReset()
      .mockImplementation(async () => ({
        sdp: "test-answer",
        sessionId: `session-${crypto.randomUUID()}`,
      }));
  });

  afterEach(async () => {
    vi.mocked(isLiveCallAvailable).mockReturnValue(true);
    await setAdmission("all");
  });

  it("[1] holds what's left of the day with no grace, and refuses less than a minute without a session", async () => {
    const { conversation, user } = await learner();
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 30, userId: user.id });

    const setup = await reserved(conversation.id);
    const row = await connection(setup.connectionId);

    expect(setup).toMatchObject({ endsAtLimit: "day", seconds: 90 });
    expect(row.heldSeconds).toBe(90);
    expect(row.deadlineAt.getTime() - row.createdAt.getTime()).toBe(90 * SECOND_MS);
    expect(row.costMicros).toBe(getLiveCallReservationMicros(90));

    const short = await learner();

    await usageRecordsFixture({
      count: 1,
      kind: "conversation",
      seconds: 70,
      userId: short.user.id,
    });

    await expect(reserve(short.conversation.id)).resolves.toStrictEqual({
      limit: { limit: TWO_MINUTES, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });

    await expect(
      prisma.liveCallConnection.count({ where: { userId: short.user.id } }),
    ).resolves.toBe(0);

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("[1] keeps a checkpoint's first window when it connects again", async () => {
    const { conversation } = await learner({ kind: "checkpoint", plus: true });
    const first = await live(conversation.id);

    advance(50);
    const second = await reserved(conversation.id);

    expect(second.seconds).toBe(TWO_MINUTES - 50);
    expect(second.deadlineAt).toBe(first.deadlineAt);
  });

  it("[1] hangs up at the deadline and never charges the learner past what it held, even when the hangup confirms late", async () => {
    const { conversation, user } = await learner();
    const setup = await live(conversation.id);
    const { providerSessionId } = await connection(setup.connectionId);

    advance(TWO_MINUTES);

    vi.mocked(hangUpLiveCallSession).mockImplementationOnce(async () => {
      advance(20);
    });

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "ended" });

    expect(hangUpLiveCallSession).toHaveBeenCalledExactlyOnceWith(providerSessionId);

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(TWO_MINUTES + 20),
      endReason: "deadline",
      state: "ended",
    });

    await expect(
      usage({ connectionId: setup.connectionId, userId: user.id }),
    ).resolves.toMatchObject({
      costMicros: getLiveCallCostMicros(TWO_MINUTES + 20),
      seconds: TWO_MINUTES,
    });
  });

  it("[2] gives two tabs reserving at once one open connection and one hold", async () => {
    const { conversation, user } = await learner();
    const started = new Date();

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

    await expect(freeDaySpent(started)).resolves.toBe(getLiveCallReservationMicros(TWO_MINUTES));
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
    const started = new Date();
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

    await expect(freeDaySpent(started)).resolves.toBe(getLiveCallCostMicros(60));
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

  it("[2] settles refused and unanswered creations on the reservation's own free day, across midnight", async () => {
    startOwnDay("23:59:00");
    const reservedOn = new Date();
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

    // The creation times out after midnight: nothing names its session.
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

    await expect(freeDaySpent(reservedOn)).resolves.toBe(
      getLiveCallCostMicros(0) + Math.max(held, getLiveCallCostMicros(90)),
    );

    await expect(freeDaySpent(new Date())).resolves.toBe(0);
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

  it("[F3] counts the clock of a call whose hangup keeps failing, until a free call that fit is refused", async () => {
    const held = getLiveCallReservationMicros(TWO_MINUTES);
    await setAdmission("all", 2 * held + 10_000);

    const stuck = await learner();
    const setup = await live(stuck.conversation.id);

    vi.mocked(hangUpLiveCallSession).mockRejectedValue(new Error("OpenAI is unavailable"));
    advance(TWO_MINUTES);

    await expect(
      endLiveCall({ connectionId: setup.connectionId, reason: "deadline" }),
    ).resolves.toStrictEqual({ status: "closing" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({ state: "live" });

    // Right at the deadline another learner's call still fits beside it, and ends unused.
    const other = await learner();
    const fits = await reserved(other.conversation.id);

    await endLanguageConversationConnection({
      connectionId: fits.connectionId,
      conversationId: other.conversation.id,
    });

    // A minute later the stuck call's clock leaves no room for it.
    advance(60);

    await expect(reserve(other.conversation.id)).resolves.toMatchObject({
      limit: { period: "day", resource: "aiSpend" },
      status: "limitReached",
    });

    mockLiveCallAdminSession({ id: other.user.id, role: "admin" });
    await prisma.user.update({ data: { role: "admin" }, where: { id: other.user.id } });

    await expect(getLiveCallAdmission()).resolves.toMatchObject({
      connections: expect.arrayContaining([
        expect.objectContaining({
          exposureMicros: getLiveCallCostMicros(TWO_MINUTES + 60),
          id: setup.connectionId,
          overdue: false,
        }),
      ]),
    });
  });

  it("[F3] counts a creation that never named its session at the larger of its reservation and the clock", async () => {
    const { conversation, user } = await learner();
    const setup = await reserved(conversation.id);
    const creation = pendingCreation();
    const offered = offer(setup, conversation.id);

    await vi.waitFor(() => expect(createLiveCallSession).toHaveBeenCalledOnce());
    advance(300);

    const { startedAt } = await connection(setup.connectionId);
    const clock = getLiveCallCostMicros(Math.ceil((Date.now() - Number(startedAt)) / SECOND_MS));

    expect(clock).toBeGreaterThan(getLiveCallReservationMicros(TWO_MINUTES));

    await prisma.user.update({ data: { role: "admin" }, where: { id: user.id } });
    mockLiveCallAdminSession({ id: user.id, role: "admin" });

    await expect(getLiveCallAdmission()).resolves.toMatchObject({
      connections: expect.arrayContaining([
        expect.objectContaining({
          exposureMicros: clock,
          id: setup.connectionId,
          overdue: true,
          state: "starting",
        }),
      ]),
    });

    creation.reject(new Error("The creation request timed out"));
    await expect(offered).resolves.toStrictEqual({ status: "retryable" });

    await expect(connection(setup.connectionId)).resolves.toMatchObject({
      costMicros: clock,
      state: "ended",
    });
  });

  it("[F6] never gives the free day's room twice to a reservation whose offer was accepted at the window's edge", async () => {
    const held = getLiveCallReservationMicros(TWO_MINUTES);
    await setAdmission("all", held);
    const reservedAt = Date.now();
    const first = await learner();
    const setup = await reserved(first.conversation.id);

    // Another transaction holds the reservation's row, so its offer, accepted just inside the
    // window, can't commit `starting` until after the window ended.
    const holder = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const holding = prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM live_call_connections WHERE id = ${setup.connectionId}::uuid FOR UPDATE`;
      const [row] = await transaction.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      holder.resolve(row?.pid ?? 0);
      await release.promise;
    });

    const pid = await holder.promise;
    vi.setSystemTime(reservedAt + 59_900);
    const offered = offer(setup, first.conversation.id);

    await waitForBlockedStatement(pid, /UPDATE.*live_call_connections/u);

    // Just past the window, another free learner reserves while the offer waits.
    vi.setSystemTime(reservedAt + 60_100);
    const second = await learner();
    const other = reserve(second.conversation.id);

    const waiting = waitForBlockedStatement(pid, /free_call_spend_days/u);
    // Settled either way; only one of the two finishes before the release.
    waiting.catch(() => null);
    await Promise.race([other, waiting]);

    release.resolve(null);
    await holding;
    await Promise.all([offered, other]);

    const open = await prisma.liveCallConnection.findMany({
      where: { state: { not: "ended" }, userId: { in: [first.user.id, second.user.id] } },
    });

    const exposure = open.reduce(
      (total, row) => total + getCallExposureMicros({ connection: row, now: new Date() }),
      0,
    );

    expect(exposure).toBeLessThanOrEqual(held);
  });

  it("[F6] counts a reservation past its connect window as nothing, refuses its offer and ends it on the next start", async () => {
    const held = getLiveCallReservationMicros(TWO_MINUTES);
    await setAdmission("all", held + 50_000);

    const { conversation, user } = await learner();
    const stale = await reserved(conversation.id);

    advance(61);

    // Its posted cost no longer holds the free day's room: another learner's call fits, then ends.
    const other = await learner();
    const fits = await reserved(other.conversation.id);

    await endLanguageConversationConnection({
      connectionId: fits.connectionId,
      conversationId: other.conversation.id,
    });

    mockSession(user.id);

    await expect(offer(stale, conversation.id)).resolves.toStrictEqual({
      status: "connectionExpired",
    });

    // The next start ends it before reading the learner's call time: the day's two minutes are back.
    await expect(reserve(conversation.id)).resolves.toMatchObject({
      setup: { seconds: TWO_MINUTES },
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

  it("[2] settles a call abandoned for a month after its hangups failed, at most a session's longest life", async () => {
    const { conversation } = await learner({ plus: true });
    const setup = await live(conversation.id);

    // Its deadline run gave up; OpenAI ended the session hours later, and the learner is back now.
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

  it("[F7] settles a deleted learner's call at its deadline, keeping its cost on the connection and the free day", async () => {
    const started = new Date();
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
    });

    await expect(freeDaySpent(started)).resolves.toBe(getLiveCallCostMicros(TWO_MINUTES));
  });

  it("[1][2] settles a creation the server never finished, by estimate, at its deadline", async () => {
    const { conversation } = await learner();
    const setup = await reserved(conversation.id);
    // The server stops mid-creation: nothing will answer it.
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

  it("[4] reads admission fresh at Connect and at the SDP step", async () => {
    const { conversation } = await learner();

    await setAdmission("off");
    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });

    await setAdmission("staff");
    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });

    const staff = await learner({ role: "admin" });
    await expect(reserve(staff.conversation.id)).resolves.toMatchObject({ status: "ready" });

    mockSession(conversation.userId);
    await setAdmission("all");
    const setup = await reserved(conversation.id);

    await setAdmission("off");
    await expect(offer(setup, conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });

    await setAdmission("all");
    vi.mocked(isLiveCallAvailable).mockReturnValue(false);
    await expect(offer(setup, conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });
    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });

    vi.mocked(isLiveCallAvailable).mockReturnValue(true);
    await prisma.liveCallSetting.delete({ where: { id: "live" } });
    await expect(reserve(conversation.id)).resolves.toStrictEqual({ status: "callsPaused" });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });
});
