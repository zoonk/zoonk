import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { openStudyDay } from "./open-study-day";

async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ userId: user.id });
  mockSession(user.id);
  return { ...fixture, user };
}

async function versions(fixture: Awaited<ReturnType<typeof setup>>) {
  const [actor, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
    prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
  ]);

  return { inputVersion: plan.inputVersion, revision: actor.learnerRevision };
}

describe("the explicit day open follows the device zone", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { inputIncrement: 2, shownDate: "2026-10-01", timeZone: "Pacific/Kiritimati" },
    { inputIncrement: 1, shownDate: "2026-09-30", timeZone: "America/New_York" },
  ])(
    "moves the zone before opening $shownDate, marking only a changed day as plan input",
    async (input) => {
      const fixture = await setup();
      const before = await versions(fixture);

      const request = {
        goalId: fixture.goal.id,
        shownDate: input.shownDate,
        timeZone: input.timeZone,
      };

      const result = await openStudyDay(request);

      expect(result).toMatchObject({
        created: true,
        localDate: new Date(input.shownDate),
        status: "opened",
      });

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: fixture.goal.id } }),
      ).resolves.toMatchObject({ timezone: input.timeZone });

      await expect(versions(fixture)).resolves.toStrictEqual({
        inputVersion: before.inputVersion + input.inputIncrement,
        revision: before.revision + 2n,
      });

      const settled = await versions(fixture);

      const replay = await countDatabaseStatements(() => openStudyDay(request));

      expect(replay.writes).toBe(0);
      expect(replay.result).toMatchObject({ created: false, status: "opened" });
      await expect(versions(fixture)).resolves.toStrictEqual(settled);
    },
  );

  it("keeps the stored day once an answer was actually recorded", async () => {
    const fixture = await setup();
    await attemptFixture({ localDate: new Date("2026-09-30"), userId: fixture.user.id });
    const before = await versions(fixture);

    await expect(
      openStudyDay({
        goalId: fixture.goal.id,
        shownDate: "2026-09-30",
        timeZone: "Pacific/Kiritimati",
      }),
    ).resolves.toMatchObject({ localDate: new Date("2026-09-30"), status: "opened" });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: fixture.goal.id } }),
    ).resolves.toMatchObject({ timezone: "UTC" });

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      revision: before.revision + 1n,
    });
  });

  it("rolls back a zone move that lost a real plan-lock race without opening a queue", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const holding = prisma.$transaction(
      async (tx) => {
        await markLearnerChanged(tx, { planInputs: true, userId: fixture.user.id });
        const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        ready.resolve(connection?.pid ?? 0);
        await release.promise;
        await tx.goal.update({ data: { timezone: "Asia/Tokyo" }, where: { id: fixture.goal.id } });
      },
      { timeout: 12_000 },
    );

    const held = Promise.allSettled([holding]);
    void holding.catch(ready.reject);
    const pid = await ready.promise;

    const opening = Promise.allSettled([
      openStudyDay({
        goalId: fixture.goal.id,
        shownDate: "2026-10-01",
        timeZone: "Pacific/Kiritimati",
      }),
    ]);

    try {
      await expect
        .poll(
          async () => prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
          AND query ~* 'plans.*FOR UPDATE'
      `,
          { interval: 10, timeout: 4000 },
        )
        .not.toHaveLength(0);
    } finally {
      release.resolve(null);
      await held;
      await opening;
    }

    await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);

    await expect(opening).resolves.toMatchObject([
      {
        status: "fulfilled",
        value: { actorId: fixture.user.id, goalId: fixture.goal.id, status: "retryable" },
      },
    ]);

    await expect(prisma.studySession.count({ where: { goalId: fixture.goal.id } })).resolves.toBe(
      0,
    );

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: fixture.goal.id } }),
    ).resolves.toMatchObject({ timezone: "Asia/Tokyo" });

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      revision: before.revision + 1n,
    });
  });
});
