import { type TransactionClient, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { getStudySession } from "../sessions/get-study-session";
import {
  type TodayViewResult,
  getTodayView,
  getTodayViewFollowingDevice,
} from "../view-models/today/get-today-view";
import { getStartOfLocalDay } from "./_utils/local-time";
import { markLearnerChanged } from "./_utils/mark-learner-changed";
import { getAnswerTimeZone } from "./_utils/owned-goal";
import {
  followGoalTimeZone,
  isTimeZoneUnchanged,
  moveGoalTimeZoneInTransaction,
} from "./follow-goal-time-zone";

const SAO_PAULO = "America/Sao_Paulo";

function localDay(timeZone: string): Date {
  return getDateInTimeZone({ date: new Date(), timeZone });
}

/** A zone whose day isn't São Paulo's right now: far ahead of it, or far behind it early on. */
function zoneOnAnotherDay(): string {
  const zones = ["Pacific/Kiritimati", "Pacific/Pago_Pago"];
  return zones.find((zone) => localDay(zone).getTime() !== localDay(SAO_PAULO).getTime()) ?? "UTC";
}

/** Ana: her goal lives in São Paulo, and today's session there is built, not opened yet. */
async function setup({ timezone = SAO_PAULO }: { timezone?: string | null } = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ timezone, userId: user.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate: localDay(timezone ?? "UTC"),
    userId: user.id,
  });

  mockSession(user.id);

  return { goal, session, user };
}

async function readZone(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.timezone;
}

/** The local day a ready Today read shows; null when it shows none. */
function todayLocalDate(result: TodayViewResult): Date | null {
  return result.status === "ready" ? result.today.session.localDate : null;
}

/** The goal a Today read is about, its day ready or still preparing. */
function todayGoalId(result: TodayViewResult): string | null {
  if (result.status === "ready") {
    return result.today.goal.id;
  }

  return "goal" in result ? result.goal.id : null;
}

/** Ana's active goal in São Paulo with a plan, in a state where Today shows no day for it. */
async function refusedTodayFixture(refusal: "explainOnly" | "guestOnboarding" | "planNotBuilt") {
  const user = await userFixture();

  // A course's plan is ready, but she's a guest who hasn't answered when her exam is yet.
  if (refusal === "guestOnboarding") {
    const { goal, plan } = await sessionGoalFixture({
      goal: {
        dailyMinutes: 30,
        kind: "exam",
        targetDate: new Date(Date.now() + 30 * MS_PER_DAY),
        timezone: SAO_PAULO,
      },
      lessons: 1,
      userId: user.id,
    });

    const details = {
      answered: ["level"],
      courseStart: { chapterId: null, dailyMinutes: 30 },
      level: "basic",
    };

    await prisma.goal.update({ data: { details }, where: { id: goal.id } });
    mockGuestSession(user.id);
    return { goal, plan, user };
  }

  // A quick explanation is her only goal, or her plan is still being built.
  const kind = refusal === "explainOnly" ? "explain" : "learn";
  const goal = await goalFixture({ kind, timezone: SAO_PAULO, userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  mockSession(user.id);
  return { goal, plan, user };
}

/**
 * Ana's goal in São Paulo, which Today shows a day for, and what her other device commits while
 * Today's follow waits: archiving her last study goal (her quick explanation then has no day), or
 * clearing a guest's onboarding answers (her goal then waits for them again).
 */
async function admittedTodayFixture(change: "lastStudyGoalArchived" | "onboardingCleared") {
  const user = await userFixture();

  if (change === "lastStudyGoalArchived") {
    const study = await goalFixture({ userId: user.id });

    const { goal, plan } = await sessionGoalFixture({
      goal: { kind: "explain", timezone: SAO_PAULO },
      userId: user.id,
    });

    mockSession(user.id);

    const write = (tx: TransactionClient) =>
      tx.goal.update({ data: { status: "archived" }, where: { id: study.id } });

    return { goal, plan, user, write };
  }

  const { goal, plan } = await sessionGoalFixture({
    goal: {
      dailyMinutes: 30,
      kind: "exam",
      targetDate: new Date(Date.now() + 30 * MS_PER_DAY),
      timezone: SAO_PAULO,
    },
    lessons: 1,
    userId: user.id,
  });

  const details = {
    answered: ["level", "targetDate", "buddy", "placement", "schedule"],
    courseStart: { chapterId: null, dailyMinutes: 30 },
    level: "basic",
  };

  await prisma.goal.update({ data: { details }, where: { id: goal.id } });
  mockGuestSession(user.id);

  const write = (tx: TransactionClient) =>
    tx.goal.update({ data: { details: {} }, where: { id: goal.id } });

  return { goal, plan, user, write };
}

/** The learner's revision and their goal plan's input version and pending reasons, as writers raise them. */
async function readVersions({ planId, userId }: { planId: string; userId: string }) {
  const [user, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ select: { learnerRevision: true }, where: { id: userId } }),
    prisma.plan.findUniqueOrThrow({
      select: { inputVersion: true, pendingAdaptation: true },
      where: { id: planId },
    }),
  ]);

  return {
    inputVersion: plan.inputVersion,
    learnerRevision: user.learnerRevision,
    pendingAdaptation: plan.pendingAdaptation,
  };
}

describe("the learner's day", () => {
  it("is the goal's stored zone, and the request's only for a goal without one", () => {
    expect(getAnswerTimeZone({ goal: { timezone: SAO_PAULO }, timeZone: "UTC" })).toBe(SAO_PAULO);

    expect(getAnswerTimeZone({ goal: { timezone: null }, timeZone: "Asia/Tokyo" })).toBe(
      "Asia/Tokyo",
    );

    expect(getAnswerTimeZone({ goal: null, timeZone: null })).toBe("UTC");
  });

  it("keeps today's session current on a device in another zone, so Continue opens it", async () => {
    const { session } = await setup();

    const result = await getStudySession({
      input: { timeZone: zoneOnAnotherDay() },
      sessionId: session.id,
    });

    expect(result).toMatchObject({ session: { current: true }, status: "ready" });
  });
});

describe("following a learner who moves", () => {
  it("moves the goal's day to the device's zone while nothing was done today", async () => {
    const { goal } = await setup();
    const zone = zoneOnAnotherDay();

    await expect(followGoalTimeZone({ goalId: goal.id, timeZone: zone })).resolves.toStrictEqual({
      learnerRevision: "1",
      moved: true,
      status: "ready",
    });

    await expect(readZone(goal.id)).resolves.toBe(zone);
  });

  it("raises the learner's revision and marks the plan's calendar changed when the goal's today becomes another date", async () => {
    const { goal, user } = await setup();
    const otherGoal = await goalFixture({ timezone: SAO_PAULO, userId: user.id });

    const [plan, otherPlan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      planFixture({ goalId: otherGoal.id }),
    ]);

    const before = await readVersions({ planId: plan.id, userId: user.id });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: zoneOnAnotherDay() }),
    ).resolves.toMatchObject({ learnerRevision: String(before.learnerRevision + 1n), moved: true });

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 1n,
      pendingAdaptation: ["calendar"],
    });

    // The learner's other goal kept its zone: its plan is checked again with no reason to wait on.
    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toMatchObject({ inputVersion: otherPlan.inputVersion + 1, pendingAdaptation: [] });
  });

  it("raises the learner's revision and marks the plan's calendar changed when the zone moves within the same date", async () => {
    // Buenos Aires keeps São Paulo's clock all year: the zone moves, the day doesn't.
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: "America/Argentina/Buenos_Aires" }),
    ).resolves.toMatchObject({ moved: true });

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 1n,
      pendingAdaptation: ["calendar"],
    });
  });

  it("keeps the goal's zone until the next day once the learner answered today, with no revision", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    await attemptFixture({ localDate: localDay(SAO_PAULO), userId: user.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });
    const tomorrow = new Date(localDay(SAO_PAULO).getTime() + MS_PER_DAY);

    // It may move at her next São Paulo midnight.
    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: zoneOnAnotherDay() }),
    ).resolves.toStrictEqual({
      moved: false,
      retryAt: getStartOfLocalDay({ localDate: tomorrow, timeZone: SAO_PAULO }).getTime(),
      status: "ready",
    });

    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);
    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(before);
  });

  it("keeps the goal's zone once a block of today's session was opened", async () => {
    const { goal, session } = await setup();

    await studySessionBlockFixture({
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: zoneOnAnotherDay() }),
    ).resolves.toMatchObject({ moved: false, status: "ready" });

    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);
  });

  it("stores the device's zone on a goal without one, and ignores a zone that isn't one", async () => {
    const { goal } = await setup({ timezone: null });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: "Mars/Olympus" }),
    ).resolves.toMatchObject({ moved: false, status: "ready" });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: SAO_PAULO }),
    ).resolves.toStrictEqual({ learnerRevision: "1", moved: true, status: "ready" });

    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);
  });

  it("says another learner's goal isn't found", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(followGoalTimeZone({ goalId: goal.id, timeZone: "UTC" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("writes nothing, not even a transaction, for a goal already in the device's zone", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });

    const counted = await countDatabaseStatements(() =>
      followGoalTimeZone({ goalId: goal.id, timeZone: SAO_PAULO }),
    );

    expect(counted).toStrictEqual({
      result: { moved: false, retryAt: expect.any(Number), status: "ready" },
      statements: 1,
      writes: 0,
    });

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(before);
  });

  it("follows the goal a request names, even when another goal is the active one", async () => {
    const { goal: named, user } = await setup();
    const active = await goalFixture({ timezone: SAO_PAULO, userId: user.id });
    await learningProfileFixture({ activeGoalId: active.id, userId: user.id });
    const zone = zoneOnAnotherDay();

    await expect(followGoalTimeZone({ goalId: named.id, timeZone: zone })).resolves.toMatchObject({
      moved: true,
      status: "ready",
    });

    await expect(Promise.all([readZone(named.id), readZone(active.id)])).resolves.toStrictEqual([
      zone,
      SAO_PAULO,
    ]);
  });
});

// The API's Today resolves its goal once and follows the device in it: the goal that moved is the
// goal it returns, and a goal Today refuses keeps its zone.
describe("Today following the device", () => {
  it("follows the goal Today reads when the request names none", async () => {
    const { goal: other, user } = await setup();

    const { goal: active } = await sessionGoalFixture({
      goal: { timezone: SAO_PAULO },
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: active.id, userId: user.id });
    const zone = zoneOnAnotherDay();

    expect(todayGoalId(await getTodayViewFollowingDevice({ timeZone: zone }))).toBe(active.id);

    await expect(Promise.all([readZone(active.id), readZone(other.id)])).resolves.toStrictEqual([
      zone,
      SAO_PAULO,
    ]);
  });

  it("follows nothing for a learner without a goal", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getTodayViewFollowingDevice({ timeZone: "UTC" })).resolves.toMatchObject({
      status: "noGoal",
    });
  });

  it.each(["named", "active"] as const)(
    "keeps a paused goal's zone, revision and plan when Today refuses it (%s)",
    async (selection) => {
      const { goal, user } = await setup();
      await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
      const plan = await planFixture({ goalId: goal.id });

      if (selection === "active") {
        await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
      }

      const before = await readVersions({ planId: plan.id, userId: user.id });

      await expect(
        getTodayViewFollowingDevice({
          goalId: selection === "named" ? goal.id : undefined,
          timeZone: zoneOnAnotherDay(),
        }),
      ).resolves.toMatchObject({ status: "goalNotActive" });

      await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);

      await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(
        before,
      );
    },
  );

  it.each([
    ["explainOnly", "noGoal"],
    ["planNotBuilt", "preparing"],
    ["guestOnboarding", "preparing"],
  ] as const)(
    "keeps the zone, revision and plan of a goal Today shows no day for (%s: %s)",
    async (refusal, status) => {
      const { goal, plan, user } = await refusedTodayFixture(refusal);
      const timeZone = zoneOnAnotherDay();
      const refused = await getTodayView({ goalId: goal.id, timeZone });
      const before = await readVersions({ planId: plan.id, userId: user.id });

      expect(refused).toMatchObject({ status });

      const followed = await getTodayViewFollowingDevice({ goalId: goal.id, timeZone });
      expect(followed).toStrictEqual(refused);

      await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);

      await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(
        before,
      );
    },
  );

  it("returns the goal it moved when the learner switches goals while the move waits", async () => {
    const user = await userFixture();

    const { goal: moving } = await sessionGoalFixture({
      goal: { timezone: SAO_PAULO },
      userId: user.id,
    });

    mockSession(user.id);
    const next = await goalFixture({ timezone: SAO_PAULO, userId: user.id });
    await learningProfileFixture({ activeGoalId: moving.id, userId: user.id });
    const device = zoneOnAnotherDay();
    const waitingBefore = new Set(await waitingOnRevision());

    // Another writer holds the learner's lock: Today resolves its goal, then its move queues.
    const writer = holdLearnerLock(user.id);
    await writer.held;
    const today = getTodayViewFollowingDevice({ timeZone: device });

    try {
      await untilQueued(waitingBefore);

      // The learner switches to another goal before the move gets the lock.
      await prisma.userLearningProfile.update({
        data: { activeGoalId: next.id },
        where: { userId: user.id },
      });
    } finally {
      writer.release();
    }

    await writer.done;

    expect(todayGoalId(await today)).toBe(moving.id);

    await expect(Promise.all([readZone(moving.id), readZone(next.id)])).resolves.toStrictEqual([
      device,
      SAO_PAULO,
    ]);
  });

  it("reads the day where another writer just moved the goal, though its own follow moved nothing", async () => {
    const user = await userFixture();

    const { goal } = await sessionGoalFixture({ goal: { timezone: SAO_PAULO }, userId: user.id });

    mockSession(user.id);
    const device = zoneOnAnotherDay();
    const waitingBefore = new Set(await waitingOnRevision());

    // Her other device moves the goal to this zone while Today, which read São Paulo, waits to.
    const other = holdLearnerLock(user.id, (tx) =>
      tx.goal.update({ data: { timezone: device }, where: { id: goal.id } }),
    );

    await other.held;
    const today = getTodayViewFollowingDevice({ goalId: goal.id, timeZone: device });

    try {
      await untilQueued(waitingBefore);
    } finally {
      other.release();
    }

    await other.done;
    const result = await today;

    expect(result.status === "ready" && result.today.session.localDate).toStrictEqual(
      localDay(device),
    );
  });
});

/** Backends waiting for a learner's revision lock right now (a writer queued behind another). */
async function waitingOnRevision(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ pid: number }[]>`
    SELECT pid FROM pg_stat_activity
    WHERE wait_event_type = 'Lock' AND query ILIKE '%learner_revision%'
  `;

  return rows.map((row) => row.pid);
}

describe("following a learner who studies while the move waits", () => {
  it("keeps the zone, and no revision of the move, when an answer commits first", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });
    const answering = Promise.withResolvers<null>();
    const commitAnswer = Promise.withResolvers<null>();
    const waitingBefore = new Set(await waitingOnRevision());

    // An answer holds the learner's lock, its attempt written but not committed yet.
    const answer = prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { userId: user.id });

      await tx.attempt.create({
        data: {
          answer: { selectedIndex: 0 },
          answeredAt: new Date(),
          durationMs: 1000,
          hour: 12,
          isCorrect: true,
          localDate: localDay(SAO_PAULO),
          userId: user.id,
          weekday: 1,
        },
      });

      answering.resolve(null);
      await commitAnswer.promise;
    });

    await answering.promise;

    // The follow finds nothing studied yet, then waits for the learner's lock.
    const follow = followGoalTimeZone({ goalId: goal.id, timeZone: zoneOnAnotherDay() });

    try {
      await expect
        .poll(async () => {
          const waiting = await waitingOnRevision();
          return waiting.some((pid) => !waitingBefore.has(pid));
        })
        .toBe(true);
    } finally {
      commitAnswer.resolve(null);
    }

    await answer;

    await expect(follow).resolves.toMatchObject({ moved: false, status: "ready" });
    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);

    // Only the answer's revision: the move's, and its plan inputs, rolled back with it.
    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputVersion: before.inputVersion,
      learnerRevision: before.learnerRevision + 1n,
      pendingAdaptation: [],
    });
  });
});

/** Holds the learner's lock in another writer's transaction, doing `write` under it, until let go. */
function holdLearnerLock(userId: string, write?: (tx: TransactionClient) => Promise<unknown>) {
  const held = Promise.withResolvers<null>();
  const release = Promise.withResolvers<null>();

  const done = prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });
    await write?.(tx);
    held.resolve(null);
    await release.promise;
  });

  return { done, held: held.promise, release: () => release.resolve(null) };
}

/** Backends waiting for a plan's lock, which a writer takes before the learner's. */
async function waitingOnPlanLock(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ pid: number }[]>`
    SELECT pid FROM pg_stat_activity
    WHERE wait_event_type = 'Lock' AND query ILIKE '%FOR UPDATE OF plan%'
  `;

  return rows.map((row) => row.pid);
}

/** Waits until a backend that wasn't waiting before queues behind a learner's revision lock. */
async function untilQueued(waitingBefore: Set<number>, readWaiting = waitingOnRevision) {
  await expect
    .poll(async () => {
      const waiting = await readWaiting();
      return waiting.some((pid) => !waitingBefore.has(pid));
    })
    .toBe(true);
}

describe("following a learner whose goal moves or whose day turns while the move waits", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves from where another writer just moved the goal, not from where it read it", async () => {
    const { goal } = await setup();
    const device = zoneOnAnotherDay();
    const waitingBefore = new Set(await waitingOnRevision());

    // Another writer moves the goal to Tokyo while this follow reads São Paulo, then waits.
    const tokyo = holdLearnerLock(goal.userId, (tx) =>
      tx.goal.update({ data: { timezone: "Asia/Tokyo" }, where: { id: goal.id } }),
    );

    await tokyo.held;
    const follow = followGoalTimeZone({ goalId: goal.id, timeZone: device });

    try {
      await untilQueued(waitingBefore);
    } finally {
      tokyo.release();
    }

    await tokyo.done;

    await expect(follow).resolves.toMatchObject({ moved: true });
    await expect(readZone(goal.id)).resolves.toBe(device);
  });

  it("moves the plan's days when a midnight passed while it waited made the move change the date", async () => {
    // 23:59:59 UTC: still March 9 both in São Paulo and in UTC, so no plan day moves yet.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-09T23:59:59.000Z"));

    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });
    const waitingBefore = new Set(await waitingOnRevision());
    const other = holdLearnerLock(user.id);

    await other.held;
    const follow = followGoalTimeZone({ goalId: goal.id, timeZone: "UTC" });

    try {
      await untilQueued(waitingBefore);
      // UTC's March 10 begins while São Paulo's March 9 goes on: now the move changes the date.
      vi.setSystemTime(new Date("2026-03-10T00:00:01.000Z"));
    } finally {
      other.release();
    }

    await other.done;

    await expect(follow).resolves.toMatchObject({ moved: true });

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 2n,
      pendingAdaptation: ["calendar"],
    });
  });
});

describe("Today following the device while another writer holds the learner's lock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers two identical follows with the moved zone's day, and moves the goal once", async () => {
    // 00:00:01 UTC: UTC's March 10 has begun while São Paulo's March 9 goes on.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-10T00:00:01.000Z"));
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { timezone: SAO_PAULO },
      userId: user.id,
    });

    mockSession(user.id);
    const before = await readVersions({ planId: plan.id, userId: user.id });
    const [onRevision, onPlan] = await Promise.all([waitingOnRevision(), waitingOnPlanLock()]);
    const other = holdLearnerLock(user.id);
    await other.held;

    // Both read São Paulo. The first then holds the plan's lock while it waits for hers.
    const follows: Promise<TodayViewResult>[] = [];

    try {
      follows.push(getTodayViewFollowingDevice({ goalId: goal.id, timeZone: "UTC" }));
      await untilQueued(new Set(onRevision));
      follows.push(getTodayViewFollowingDevice({ goalId: goal.id, timeZone: "UTC" }));
      await untilQueued(new Set(onPlan), waitingOnPlanLock);
    } finally {
      other.release();
    }

    await other.done;
    const results = await Promise.all(follows);
    const days = results.map((today) => todayLocalDate(today));
    const march10 = new Date("2026-03-10T00:00:00.000Z");

    expect(days).toStrictEqual([march10, march10]);

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 2n,
      pendingAdaptation: ["calendar"],
    });
  });

  it("keeps the zone, revision and plan of a goal paused while Today's follow waits", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { timezone: SAO_PAULO },
      userId: user.id,
    });

    mockSession(user.id);
    const before = await readVersions({ planId: plan.id, userId: user.id });
    const waitingBefore = new Set(await waitingOnRevision());

    // She pauses it on another device while Today, which admitted it active, waits to move it.
    const pause = holdLearnerLock(user.id, (tx) =>
      tx.goal.update({ data: { status: "paused" }, where: { id: goal.id } }),
    );

    await pause.held;
    const today = getTodayViewFollowingDevice({ goalId: goal.id, timeZone: zoneOnAnotherDay() });

    try {
      await untilQueued(waitingBefore);
    } finally {
      pause.release();
    }

    await pause.done;

    await expect(today).resolves.toMatchObject({ status: "goalNotActive" });
    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);

    // Only the pause's own revision: the refused read wrote nothing.
    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      ...before,
      learnerRevision: before.learnerRevision + 1n,
    });
  });

  it.each([
    ["lastStudyGoalArchived", "noGoal"],
    ["onboardingCleared", "preparing"],
  ] as const)(
    "keeps the zone, revision and plan of a goal Today stops showing while its follow waits (%s: %s)",
    async (change, status) => {
      const { goal, plan, user, write } = await admittedTodayFixture(change);
      const timeZone = zoneOnAnotherDay();

      await expect(getTodayView({ goalId: goal.id, timeZone })).resolves.toMatchObject({
        status: "ready",
      });

      const before = await readVersions({ planId: plan.id, userId: user.id });
      const waitingBefore = new Set(await waitingOnRevision());
      const other = holdLearnerLock(user.id, write);
      await other.held;
      const today = getTodayViewFollowingDevice({ goalId: goal.id, timeZone });

      try {
        await untilQueued(waitingBefore);
      } finally {
        other.release();
      }

      await other.done;
      const followed = await today;
      const refused = await getTodayView({ goalId: goal.id, timeZone });

      expect(refused).toMatchObject({ status });
      expect(followed).toStrictEqual(refused);
      await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);

      // Only the other writer's own revision: the refused read wrote nothing.
      await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
        ...before,
        learnerRevision: before.learnerRevision + 1n,
      });
    },
  );
});

describe("the moment a follow that couldn't move may ask again", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the next day where the goal is now, after another writer moved it and she studied", async () => {
    // 13:00 UTC: March 9 in São Paulo, in Tokyo and in UTC alike.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-09T13:00:00.000Z"));

    const { goal, user } = await setup();
    const waitingBefore = new Set(await waitingOnRevision());

    // Another writer moves the goal to Tokyo and records an answer, while this follow waits.
    const tokyo = holdLearnerLock(user.id, async (tx) => {
      await tx.goal.update({ data: { timezone: "Asia/Tokyo" }, where: { id: goal.id } });

      await tx.attempt.create({
        data: {
          answer: { selectedIndex: 0 },
          answeredAt: new Date(),
          durationMs: 1000,
          hour: 13,
          isCorrect: true,
          localDate: new Date("2026-03-09T00:00:00.000Z"),
          userId: user.id,
          weekday: 1,
        },
      });
    });

    await tokyo.held;
    const follow = followGoalTimeZone({ goalId: goal.id, timeZone: "UTC" });

    try {
      await untilQueued(waitingBefore);
    } finally {
      tokyo.release();
    }

    await tokyo.done;

    // Tokyo's next day, not São Paulo's: March 10 begins there at 15:00 UTC.
    await expect(follow).resolves.toStrictEqual({
      moved: false,
      retryAt: new Date("2026-03-09T15:00:00.000Z").getTime(),
      status: "ready",
    });
  });

  it("never answers the old zone's next day once another writer moved the goal and she studied", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-09T13:00:00.000Z"));

    const { goal, user } = await setup();

    // Between this follow's read of São Paulo and its first look at her day: Tokyo, and an answer.
    await prisma.goal.update({ data: { timezone: "Asia/Tokyo" }, where: { id: goal.id } });
    await attemptFixture({ localDate: new Date("2026-03-09T00:00:00.000Z"), userId: user.id });

    const refused = await prisma
      .$transaction((tx) =>
        moveGoalTimeZoneInTransaction(tx, {
          fromZone: SAO_PAULO,
          goalId: goal.id,
          toZone: "UTC",
          userId: user.id,
        }),
      )
      .catch((error: unknown) => error);

    expect(isTimeZoneUnchanged(refused) && refused.reason).toBe("zoneChanged");
  });

  it("is the day after the one it checked, however late the answer comes back", async () => {
    // 23:59:59 UTC on March 9, on a UTC goal she studied that day.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-09T23:59:59.000Z"));

    const { goal, user } = await setup({ timezone: "UTC" });
    await attemptFixture({ localDate: new Date("2026-03-09T00:00:00.000Z"), userId: user.id });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: "Asia/Tokyo" }),
    ).resolves.toStrictEqual({
      moved: false,
      retryAt: new Date("2026-03-10T00:00:00.000Z").getTime(),
      status: "ready",
    });
  });
});

describe("moving a goal's zone inside a writer's transaction", () => {
  it("writes nothing for a goal already in that zone", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });

    await expect(
      prisma.$transaction((tx) =>
        moveGoalTimeZoneInTransaction(tx, {
          fromZone: SAO_PAULO,
          goalId: goal.id,
          toZone: SAO_PAULO,
          userId: user.id,
        }),
      ),
    ).resolves.toMatchObject({ kind: "unchanged" });

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(before);
  });

  it("reads only through the writer's transaction, which may hold the last free connection", async () => {
    const { goal, user } = await setup();

    const reads = [
      vi.spyOn(prisma.attempt, "findFirst"),
      vi.spyOn(prisma.studySessionBlock, "findFirst"),
    ];

    try {
      await expect(
        prisma.$transaction((tx) =>
          moveGoalTimeZoneInTransaction(tx, {
            fromZone: SAO_PAULO,
            goalId: goal.id,
            toZone: zoneOnAnotherDay(),
            userId: user.id,
          }),
        ),
      ).resolves.toMatchObject({ kind: "moved" });

      for (const read of reads) {
        expect(read).not.toHaveBeenCalled();
      }
    } finally {
      for (const read of reads) {
        read.mockRestore();
      }
    }
  });

  it("rolls its revision back when another writer moved the zone first, which keeps its own", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });

    // Another writer moved the goal to Tokyo after this one read São Paulo.
    await prisma.goal.update({ data: { timezone: "Asia/Tokyo" }, where: { id: goal.id } });
    const before = await readVersions({ planId: plan.id, userId: user.id });

    const lost = await prisma
      .$transaction((tx) =>
        moveGoalTimeZoneInTransaction(tx, {
          fromZone: SAO_PAULO,
          goalId: goal.id,
          toZone: zoneOnAnotherDay(),
          userId: user.id,
        }),
      )
      .catch((error: unknown) => error);

    // The caller tells this rollback from a real failure.
    expect(isTimeZoneUnchanged(lost) && lost.reason).toBe("zoneChanged");
    expect(isTimeZoneUnchanged(new Error("connection lost"))).toBe(false);

    await expect(readZone(goal.id)).resolves.toBe("Asia/Tokyo");
    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(before);
  });

  it("takes the plan's lock before the learner's and the goal's, beside a concurrent plan writer", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const locked = Promise.withResolvers<null>();
    const continuePlanWriter = Promise.withResolvers<null>();
    const movePID = Promise.withResolvers<number>();

    // A plan writer holds the plan, then marks the learner and writes the goal row.
    const planWriter = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      locked.resolve(null);
      await continuePlanWriter.promise;
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await tx.goal.update({ data: { title: "Moved by the plan" }, where: { id: goal.id } });
    });

    await locked.promise;

    const move = prisma.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;

      if (!backend) {
        throw new Error("Expected transaction backend");
      }

      movePID.resolve(backend.pid);

      return moveGoalTimeZoneInTransaction(tx, {
        fromZone: SAO_PAULO,
        goalId: goal.id,
        toZone: zoneOnAnotherDay(),
        userId: user.id,
      });
    });

    const pid = await movePID.promise;

    try {
      // The move waits on the plan, before it holds the learner's or the goal's row.
      await expect
        .poll(async () => {
          const [backend] = await prisma.$queryRaw<{ waiting: boolean }[]>`
            SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = ${pid}
          `;

          return backend?.waiting;
        })
        .toBe(true);
    } finally {
      continuePlanWriter.resolve(null);
    }

    await expect(Promise.all([planWriter, move])).resolves.toMatchObject([
      undefined,
      { kind: "moved", learnerRevision: 2n, planInputsChanged: true },
    ]);

    await expect(readZone(goal.id)).resolves.toBe(zoneOnAnotherDay());
  });
});
