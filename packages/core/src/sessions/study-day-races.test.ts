import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { toDayBlockRef } from "./day-block";
import { getSessionPageView } from "./get-session-page-view";
import { openStudyDay } from "./open-study-day";

async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ userId: user.id });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);

  return {
    ...fixture,
    input: { goalId: fixture.goal.id, shownDate: "2026-09-30", timeZone: "UTC" },
    user,
  };
}

async function versions(fixture: Awaited<ReturnType<typeof setup>>) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
  return { inputVersion: plan.inputVersion };
}

describe("the explicit study-day open", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("persists exactly the displayed logical work, without substituting IDs for its identity", async () => {
    const { input } = await setup();
    const before = await getSessionPageView(input);

    if (before.status !== "unstarted") {
      throw new Error("Expected an actual unopened preview");
    }

    const result = await openStudyDay({
      ...input,
      target: { kind: "next", shown: before.next?.ref ?? null },
    });

    if (result.status !== "opened") {
      throw new Error("Expected the learner's open to succeed");
    }

    expect(result.session.blocks.map(toDayBlockRef)).toStrictEqual(
      before.day.blocks.map(toDayBlockRef),
    );

    expect(result.session.minutes).toStrictEqual(before.day.minutes);
    expect(result.target && toDayBlockRef(result.target)).toStrictEqual(before.next?.ref);
    expect(result.targetStatus).toBe("next");
    expect(result.session.blocks.every((block) => block.id.length > 0)).toBe(true);
    expect(before.day.blocks.every((block) => !("id" in block))).toBe(true);
  });

  it("creates one queue and marks the plan once across concurrent opens", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    const results = await Promise.all(Array.from({ length: 5 }, () => openStudyDay(fixture.input)));
    const sessions = results.flatMap((result) => (result.status === "opened" ? [result] : []));

    expect(sessions).toHaveLength(5);
    expect(sessions.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(sessions.map((result) => result.sessionId)).size).toBe(1);
    const [first] = sessions;

    if (!first) {
      throw new Error("Expected one real persisted queue");
    }

    expect(sessions.map((result) => result.session.blocks)).toStrictEqual(
      sessions.map(() => first.session.blocks),
    );

    await expect(prisma.studySession.count({ where: { goalId: fixture.goal.id } })).resolves.toBe(
      1,
    );

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
    });
  });

  it("replays an existing queue without a write", async () => {
    const fixture = await setup();
    const first = await openStudyDay(fixture.input);
    const before = await versions(fixture);
    const replay = await countDatabaseStatements(() => openStudyDay(fixture.input));

    expect(replay.writes).toBe(0);
    expect(replay.result).toStrictEqual({ ...first, created: false });
    await expect(versions(fixture)).resolves.toStrictEqual(before);
  });

  it("rolls back its own mark when inputs change while opening waits, leaving retry to another request", async () => {
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
        await tx.goal.update({ data: { dailyMinutes: 30 }, where: { id: fixture.goal.id } });
      },
      { timeout: 12_000 },
    );

    const held = Promise.allSettled([holding]);
    void holding.catch(ready.reject);
    const pid = await ready.promise;
    const opening = Promise.allSettled([openStudyDay(fixture.input)]);

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
      { status: "fulfilled", value: { goalId: fixture.goal.id, status: "retryable" } },
    ]);

    await expect(prisma.studySession.count({ where: { goalId: fixture.goal.id } })).resolves.toBe(
      0,
    );

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
    });

    await expect(openStudyDay(fixture.input)).resolves.toMatchObject({
      created: true,
      status: "opened",
    });
  });
});
