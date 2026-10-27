import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged, markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { openStudyDay } from "../sessions/open-study-day";
import { getTodayView } from "../view-models/today/get-today-view";
import { mandatoryPhasePlanFixture } from "./_test-utils/mandatory-phase-plan";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { acknowledgeTodayPlanChange } from "./acknowledge-today-plan-change";

const PRIOR_DAY = new Date("2026-10-13T12:00:00Z");
const NEXT_DAY = new Date("2026-10-14T12:00:00Z");

async function computedNoticeFixture() {
  const fixture = await mandatoryPhasePlanFixture({ atRisk: true });
  mockSession(fixture.user.id);
  vi.setSystemTime(NEXT_DAY);

  const read = await countDatabaseStatements(() =>
    getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
  );

  expect(read.writes).toBe(0);
  expect(read.result.status).toBe("ready");

  if (
    read.result.status !== "ready" ||
    !read.result.today.planChange ||
    !read.result.today.noticeBasis
  ) {
    throw new Error("Expected the actual computed mandatory notice");
  }

  expect(read.result.today.planChange.id).toBeNull();

  return {
    ...fixture,
    input: {
      basis: read.result.today.noticeBasis,
      goalId: fixture.goal.id,
      kind: "computed" as const,
      shownDate: "2026-10-14",
      timeZone: "UTC",
    },
    notice: read.result.today.planChange,
  };
}

async function noticeState(userId: string) {
  const [plans, changes, sessions] = await Promise.all([
    prisma.plan.findMany({
      include: { items: { orderBy: { id: "asc" } } },
      orderBy: { id: "asc" },
      where: { goal: { userId } },
    }),
    prisma.planChange.findMany({ orderBy: { id: "asc" }, where: { plan: { goal: { userId } } } }),
    prisma.studySession.findMany({ include: { blocks: true }, where: { userId } }),
  ]);

  return { changes, plans, sessions };
}

describe("acknowledging Today's computed mandatory notice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PRIOR_DAY);
  });

  afterEach(() => vi.useRealTimers());

  it("persists the exact notice and its plan, without opening a session, and replays without a mark", async () => {
    const fixture = await computedNoticeFixture();
    const otherGoal = await goalFixture({ userId: fixture.user.id });
    const otherPlan = await planFixture({ goalId: otherGoal.id });
    const result = await acknowledgeTodayPlanChange(fixture.input);
    expect(result).toMatchObject({ status: "acknowledged" });

    if (result.status !== "acknowledged") {
      throw new Error("Expected the persisted acknowledgment");
    }

    const after = await noticeState(fixture.user.id);
    expect(after.sessions).toStrictEqual([]);

    expect(after.plans.find((plan) => plan.id === fixture.plan.id)).toMatchObject({
      inputVersion: fixture.plan.inputVersion + 1,
      version: fixture.plan.version + 1,
    });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toStrictEqual(otherPlan);

    const change = after.changes.find((row) => row.id === result.changeId);

    expect(change).toMatchObject({
      kind: "missedDays",
      planId: fixture.plan.id,
      status: "applied",
    });

    const payload = parsePlanChangePayload(change?.payload);
    expect(payload.effect).toStrictEqual(fixture.notice.effect);
    expect(payload.seenAt).toBe(NEXT_DAY.toISOString());

    expect(payload.acknowledgedRead).toStrictEqual({
      inputVersion: fixture.input.basis.inputVersion,
      studyDay: fixture.input.shownDate,
      version: fixture.input.basis.version,
    });

    expect(after.changes.find((row) => row.id === fixture.pending.id)?.status).toBe("replaced");
    const replay = await countDatabaseStatements(() => acknowledgeTodayPlanChange(fixture.input));
    expect(replay.result).toStrictEqual(result);
    expect(replay.writes).toBe(0);
    await expect(noticeState(fixture.user.id)).resolves.toStrictEqual(after);
    const next = await getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });
    expect(next).toMatchObject({ status: "ready", today: { planChange: null } });
  });

  it("concurrent duplicate acknowledgments publish one notice and mark the plan once", async () => {
    const fixture = await computedNoticeFixture();
    const before = await noticeState(fixture.user.id);

    const results = await Promise.all([
      acknowledgeTodayPlanChange(fixture.input),
      acknowledgeTodayPlanChange(fixture.input),
    ]);

    expect(results[0]).toMatchObject({ status: "acknowledged" });
    expect(results[1]).toStrictEqual(results[0]);
    const after = await noticeState(fixture.user.id);
    expect(after.changes.filter((row) => row.status === "applied")).toHaveLength(1);
    expect(after.sessions).toStrictEqual([]);
    expect(after.plans[0]?.inputVersion).toBe(before.plans[0]!.inputVersion + 1);
  });

  it("rolls back the acknowledgment's early mark when another plan writer wins first", async () => {
    const fixture = await computedNoticeFixture();
    const before = await noticeState(fixture.user.id);
    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const writing = prisma.$transaction(
      async (tx) => {
        await markPlansChanged(tx, { planIds: [fixture.plan.id] });
        const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        ready.resolve(connection!.pid);
        await release.promise;
        await tx.goal.update({ data: { dailyMinutes: 5 }, where: { id: fixture.goal.id } });
      },
      { timeout: 12_000 },
    );

    void writing.catch(ready.reject);
    const held = Promise.allSettled([writing]);
    const pid = await ready.promise;
    const acknowledging = acknowledgeTodayPlanChange(fixture.input);
    const handled = Promise.allSettled([acknowledging]);

    try {
      await expect
        .poll(
          () => prisma.$queryRaw<{ query: string }[]>`
        SELECT query FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
          AND query ~* 'plans'
      `,
          { interval: 10, timeout: 4000 },
        )
        .not.toHaveLength(0);
    } finally {
      release.resolve(null);
      await held;
      await handled;
    }

    await expect(writing).resolves.toBeUndefined();
    await expect(acknowledging).resolves.toStrictEqual({ status: "retryable" });
    const after = await noticeState(fixture.user.id);
    expect(after.plans[0]?.inputVersion).toBe(before.plans[0]!.inputVersion + 1);
    expect(after.changes).toStrictEqual(before.changes);
    expect(after.sessions).toStrictEqual([]);
  });

  it("acknowledges an already stored notice without changing the plan or duplicating its mark", async () => {
    const fixture = await computedNoticeFixture();

    await expect(
      openStudyDay({
        goalId: fixture.goal.id,
        keepEmpty: true,
        shownDate: fixture.input.shownDate,
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ status: "opened" });

    const change = await prisma.planChange.findFirstOrThrow({
      where: { planId: fixture.plan.id, status: "applied" },
    });

    const before = await noticeState(fixture.user.id);
    const input = { changeId: change.id, kind: "stored" as const };

    const results = await Promise.all([
      acknowledgeTodayPlanChange(input),
      acknowledgeTodayPlanChange(input),
    ]);

    expect(results[0]).toMatchObject({ changeId: change.id, status: "acknowledged" });
    expect(results[1]).toStrictEqual(results[0]);
    const after = await noticeState(fixture.user.id);
    expect(after.plans).toStrictEqual(before.plans);
    expect(after.sessions).toStrictEqual(before.sessions);
    const replay = await countDatabaseStatements(() => acknowledgeTodayPlanChange(input));
    expect(replay.writes).toBe(0);
    expect(replay.result).toStrictEqual(results[0]);
  });

  it.each(["planInputs", "day", "inactive", "foreign", "signedOut"] as const)(
    "refuses %s without any writes",
    async (reason) => {
      const fixture = await computedNoticeFixture();

      if (reason === "planInputs") {
        await prisma.$transaction((tx) =>
          markLearnerChanged(tx, { planInputs: true, userId: fixture.user.id }),
        );
      }

      if (reason === "inactive") {
        await prisma.goal.update({ data: { status: "paused" }, where: { id: fixture.goal.id } });
      }

      if (reason === "foreign") {
        const stranger = await userFixture();
        mockSession(stranger.id);
      }

      if (reason === "signedOut") {
        mockSession(null);
      }

      const input =
        reason === "day" ? { ...fixture.input, shownDate: "2026-10-13" } : fixture.input;

      const before = await noticeState(fixture.user.id);
      const result = await countDatabaseStatements(() => acknowledgeTodayPlanChange(input));

      const expected = {
        day: "otherDay",
        foreign: "notFound",
        inactive: "goalNotActive",
        planInputs: "retryable",
        signedOut: "unauthorized",
      };

      expect(result.result.status).toBe(expected[reason]);
      expect(result.writes).toBe(0);
      await expect(noticeState(fixture.user.id)).resolves.toStrictEqual(before);
    },
  );
});
