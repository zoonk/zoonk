import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { findOwnedPlan } from "../plans/_utils/owned-plan";
import { loadPlanAtToken } from "../plans/_utils/plan-token";
import { commitPlan, computePlan } from "../plans/_utils/replan";
import { withPlanRetry } from "../plans/plan-conflict";
import { lapsedDayFixture, readLapsedDayState } from "./_test-utils/entitlement-lapse";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { openStudyDay } from "./open-study-day";

async function unopenedDayFixture() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ goal: { dailyMinutes: 30 }, userId: user.id });
  mockAccountSession({ user });
  return { ...fixture, user };
}

/** A real table lock pauses only the later plan-basis read, after Open read the old goal. */
async function changeBeforeBasis({
  goalId,
  userId,
  read,
}: {
  goalId: string;
  userId: string;
  read?: () => Promise<unknown>;
}) {
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const writing = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await markLearnerChanged(tx, { planInputs: true, userId });
      await tx.$executeRaw`LOCK TABLE plans IN ACCESS EXCLUSIVE MODE`;
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(connection!.pid);
      await release.promise;
      await tx.goal.update({ data: { dailyMinutes: 5 }, where: { id: goalId } });
    },
    { timeout: 12_000 },
  );

  void writing.catch(ready.reject);
  const held = Promise.allSettled([writing]);

  try {
    const pid = await ready.promise;

    const opening = Promise.allSettled([
      read ? read() : openStudyDay({ goalId, shownDate: "2026-09-30", timeZone: "UTC" }),
    ]);

    try {
      await expect
        .poll(
          () => prisma.$queryRaw<{ query: string }[]>`
        SELECT query FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
          AND query ~* 'SELECT.*plans'
      `,
          { interval: 10, timeout: 4000 },
        )
        .not.toHaveLength(0);
    } finally {
      release.resolve(null);
      await opening;
    }

    await expect(writing).resolves.toBeUndefined();
    return await opening;
  } finally {
    release.resolve(null);
    await held;
  }
}

describe("Open binds the goal snapshot to the later plan basis", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("loads a writer's goal only after the token it will commit", async () => {
    const { goal, user } = await unopenedDayFixture();

    const result = await changeBeforeBasis({
      goalId: goal.id,
      read: () => findOwnedPlan({ goalId: goal.id }),
      userId: user.id,
    });

    expect(result).toMatchObject([
      { status: "fulfilled", value: { context: { goal: { dailyMinutes: 5 } }, status: "ready" } },
    ]);
  });

  it("retries a computed writer from fresh inputs after losing its token", async () => {
    const { goal, user } = await unopenedDayFixture();
    const attempts: number[] = [];

    await withPlanRetry(async () => {
      const context = await loadPlanAtToken(goal.id);
      expect(context).not.toBeNull();
      attempts.push(context!.goal.dailyMinutes);
      const computed = await computePlan({ context: context!, mode: "automatic" });

      if (attempts.length === 1) {
        await prisma.$transaction(async (tx) => {
          await markLearnerChanged(tx, { planInputs: true, userId: user.id });
          await tx.goal.update({ data: { dailyMinutes: 5 }, where: { id: goal.id } });
        });
      }

      await commitPlan({ change: null, computed, context: context! });
    });

    expect(attempts).toStrictEqual([30, 5]);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 5,
    });
  });

  it.each(["first day", "entitlement refill"])(
    "rolls back stale %s admission when minutes change before the basis read",
    async (kind) => {
      const day = kind === "first day" ? await unopenedDayFixture() : await lapsedDayFixture();
      await prisma.goal.update({ data: { dailyMinutes: 30 }, where: { id: day.goal.id } });
      const before = await readLapsedDayState(day.user.id);
      const opening = await changeBeforeBasis({ goalId: day.goal.id, userId: day.user.id });
      expect(opening).toMatchObject([{ status: "fulfilled", value: { status: "retryable" } }]);
      const after = await readLapsedDayState(day.user.id);
      expect(after.sessions).toStrictEqual(before.sessions);
      expect(after.plans[0]?.inputVersion).toBe(before.plans[0]!.inputVersion + 1);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: day.goal.id } }),
      ).resolves.toMatchObject({ dailyMinutes: 5 });
    },
  );
});
