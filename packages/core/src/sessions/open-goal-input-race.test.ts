import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
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
async function changeBeforeBasis({ goalId, userId }: { goalId: string; userId: string }) {
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
      openStudyDay({ goalId, shownDate: "2026-09-30", timeZone: "UTC" }),
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
