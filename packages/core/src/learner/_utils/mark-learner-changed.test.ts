import { type TransactionClient, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-revision";
import { markPlanWrite } from "../../plans/_utils/mark-plan-write";
import { acknowledgePlanInputs } from "../../plans/_utils/write-plan";
import { PlanConflictError } from "../../plans/plan-conflict";
import { markLearnerChanged, markPlansChanged } from "./mark-learner-changed";

async function revision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}

async function plan(userId: string) {
  const goal = await goalFixture({ userId });
  return planFixture({ goalId: goal.id });
}

function queryText(args: unknown): string {
  if (typeof args === "object" && args !== null && "sql" in args && typeof args.sql === "string") {
    return args.sql;
  }

  if (Array.isArray(args)) {
    return args.every((part) => typeof part === "string") ? args.join("") : queryText(args[0]);
  }

  throw new Error("Expected a raw SQL query at the Prisma observation boundary");
}

/** Observe real SQL through Prisma's query lifecycle, without changing its args or results. */
function observeStatements() {
  const statements: string[] = [];

  const client = prisma.$extends({
    query: {
      $executeRaw({ args, query }) {
        statements.push(queryText(args));
        return query(args);
      },
      $queryRaw({ args, query }) {
        statements.push(queryText(args));
        return query(args);
      },
    },
  });

  return { client, statements };
}

describe(markLearnerChanged, () => {
  it("stores a session's pending pace only on that goal while preserving all epoch guards", async () => {
    const user = await userFixture();
    const [sessionPlan, otherPlan] = await Promise.all([plan(user.id), plan(user.id)]);

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, {
        adaptation: ["pace", "rebalance"],
        adaptationGoalId: sessionPlan.goalId,
        pendingPace: { factor: 1.2, source: "own" },
        planInputs: true,
        userId: user.id,
      }),
    );

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: sessionPlan.id } }),
    ).resolves.toMatchObject({
      inputVersion: 1,
      pendingAdaptation: ["pace", "rebalance"],
      pendingPace: { factor: 1.2, source: "own" },
    });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toMatchObject({ inputVersion: 1, pendingAdaptation: [], pendingPace: null });
  });

  it("unions reasons with the epoch mark and preserves them on a harmless write", async () => {
    const user = await userFixture();
    const saved = await plan(user.id);

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, {
        adaptation: ["goalSource", "content", "content"],
        planInputs: true,
        userId: user.id,
      }),
    );

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: saved.id } })).resolves.toMatchObject(
      { inputVersion: saved.inputVersion + 2, pendingAdaptation: ["content", "goalSource"] },
    );
  });

  it("increments monotonically once per call, including plan-input changes", async () => {
    const user = await userFixture();
    await expect(revision(user.id)).resolves.toBe(0n);

    const results = await prisma.$transaction(async (tx) => [
      await markLearnerChanged(tx, { userId: user.id }),
      await markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    ]);

    expect(results).toStrictEqual([{ learnerRevision: 1n }, { learnerRevision: 2n }]);
    await expect(revision(user.id)).resolves.toBe(2n);
  });

  it("invalidates only the learner's owned plans and leaves plan edit versions alone", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const plans = await Promise.all([plan(owner.id), plan(owner.id), plan(other.id)]);

    await prisma.$transaction((tx) => markLearnerChanged(tx, { userId: owner.id }));

    await expect(
      prisma.plan.findMany({
        orderBy: { id: "asc" },
        where: { id: { in: plans.map((row) => row.id) } },
      }),
    ).resolves.toMatchObject(
      plans
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map(() => ({ inputVersion: 0, version: 1 })),
    );

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: owner.id }),
    );

    const rows = await prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } });
    const versions = new Map(rows.map((row) => [row.id, row.inputVersion]));

    expect(plans.map((row) => versions.get(row.id))).toStrictEqual([1, 1, 0]);
    expect(rows.every((row) => row.version === 1)).toBe(true);
    await expect(revision(other.id)).resolves.toBe(0n);
  });

  it("locks requested owned plans before the learner without invalidating planning inputs", async () => {
    const user = await userFixture();
    const plans = await Promise.all([plan(user.id), plan(user.id)]);
    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markLearnerChanged(tx, {
        lockPlanIds: [plans[1]!.id, plans[0]!.id, plans[1]!.id],
        userId: user.id,
      }),
    );

    expect(statements[0]).toMatch(/SELECT plan\.id[\s\S]*ORDER BY plan\.id FOR UPDATE OF plan/u);
    expect(statements[1]).toMatch(/UPDATE users/u);
    expect(statements.some((query) => query.includes("input_version"))).toBe(false);
    await expect(revision(user.id)).resolves.toBe(1n);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 0, version: 1 })));
  });

  it("serializes concurrent transactions without losing increments", async () => {
    const user = await userFixture();

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        prisma.$transaction((tx) => markLearnerChanged(tx, { userId: user.id })),
      ),
    );

    expect(new Set(results.map((result) => result.learnerRevision))).toStrictEqual(
      new Set([1n, 2n, 3n, 4n]),
    );

    await expect(revision(user.id)).resolves.toBe(4n);
  });

  it("includes guest learners and rolls the revision back with the domain write", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.update({ data: { name: "Rolled back" }, where: { id: user.id } });

        await expect(markLearnerChanged(tx, { userId: user.id })).resolves.toStrictEqual({
          learnerRevision: 1n,
        });

        throw new Error("Roll back domain write");
      }),
    ).rejects.toThrow("Roll back domain write");

    await expect(revision(user.id)).resolves.toBe(0n);
    const restoredUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(restoredUser.name).toBe(user.name);

    await expect(
      prisma.$transaction((tx) => markLearnerChanged(tx, { userId: user.id })),
    ).resolves.toStrictEqual({ learnerRevision: 1n });
  });
});

describe("all-plan adaptation composition", () => {
  it("unions global reasons without broadening a session goal's reasons or pace", async () => {
    const [user, stranger] = await Promise.all([userFixture(), userFixture()]);

    const [sessionPlan, sibling, foreign] = await Promise.all([
      plan(user.id),
      plan(user.id),
      plan(stranger.id),
    ]);

    const priorPace = { factor: 0.8, source: "own" };
    const sampledPace = { factor: 1.2, source: "shared" };

    await prisma.plan.update({
      data: { pendingAdaptation: ["content"], pendingPace: priorPace },
      where: { id: sibling.id },
    });

    await prisma.goal.update({ data: { status: "paused" }, where: { id: sibling.goalId } });

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, {
        adaptation: ["calendar", "pace", "rebalance"],
        adaptationGoalId: sessionPlan.goalId,
        allPlansAdaptation: ["calendar", "calendar", "goalSource"],
        pendingPace: sampledPace,
        userId: user.id,
      }),
    );

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: sessionPlan.id } }),
    ).resolves.toMatchObject({
      inputVersion: sessionPlan.inputVersion + 1,
      pendingAdaptation: ["goalSource", "calendar", "pace", "rebalance"],
      pendingPace: sampledPace,
      version: sessionPlan.version,
    });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: sibling.id } }),
    ).resolves.toMatchObject({
      inputVersion: sibling.inputVersion + 1,
      pendingAdaptation: ["content", "goalSource", "calendar"],
      pendingPace: priorPace,
      version: sibling.version,
    });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: foreign.id } }),
    ).resolves.toStrictEqual(foreign);

    await expect(revision(user.id)).resolves.toBe(1n);
    await expect(revision(stranger.id)).resolves.toBe(0n);
  });

  it("upgrades a revision-only marker with exactly one plans update before one user update", async () => {
    const user = await userFixture();
    const plans = await Promise.all([plan(user.id), plan(user.id)]);
    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markLearnerChanged(tx, { allPlansAdaptation: ["calendar"], userId: user.id }),
    );

    expect(statements.filter((query) => /^\s*UPDATE plans\b/iu.test(query))).toHaveLength(1);
    expect(statements.filter((query) => /^\s*UPDATE users\b/iu.test(query))).toHaveLength(1);
    const learnerWrite = statements.findIndex((query) => /^\s*UPDATE users\b/iu.test(query));

    const locks = statements.flatMap((query, index) =>
      /FOR UPDATE OF plan/u.test(query) ? [index] : [],
    );

    expect(locks.length).toBeGreaterThan(0);
    expect(locks.every((index) => index < learnerWrite)).toBe(true);
    await expect(revision(user.id)).resolves.toBe(1n);
    const rows = await prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } });
    expect(rows.every((row) => row.inputVersion === 1 && row.version === 1)).toBe(true);
    expect(rows.every((row) => row.pendingAdaptation.join(",") === "calendar")).toBe(true);
  });

  it.each([false, true])(
    "preserves distinct pending pace and reasons without a goal (move: %s)",
    async (move) => {
      const user = await userFixture();
      const plans = await Promise.all([plan(user.id), plan(user.id)]);

      const before = await Promise.all(
        plans.map((row, index) =>
          prisma.plan.update({
            data: {
              pendingAdaptation: [index === 0 ? "content" : "goalSource"],
              pendingPace: {
                factor: index === 0 ? 0.8 : 1.4,
                source: index === 0 ? "own" : "shared",
              },
            },
            where: { id: row.id },
          }),
        ),
      );

      await prisma.$transaction((tx) =>
        markLearnerChanged(tx, { allPlansAdaptation: move ? ["calendar"] : [], userId: user.id }),
      );

      await Promise.all(
        before.map((row) =>
          expect(prisma.plan.findUniqueOrThrow({ where: { id: row.id } })).resolves.toStrictEqual({
            ...row,
            inputVersion: row.inputVersion + (move ? 1 : 0),
            pendingAdaptation: move
              ? [...row.pendingAdaptation, "calendar"]
              : row.pendingAdaptation,
          }),
        ),
      );

      await expect(revision(user.id)).resolves.toBe(1n);
    },
  );

  it("marks a learner with zero plans without inventing a target", async () => {
    const user = await userFixture();

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { allPlansAdaptation: ["calendar"], userId: user.id }),
    );

    await expect(prisma.plan.count({ where: { goal: { userId: user.id } } })).resolves.toBe(0);
    await expect(revision(user.id)).resolves.toBe(1n);
  });

  it("rolls both reason scopes, sample and all epochs back with the domain write", async () => {
    const user = await userFixture();
    const plans = await Promise.all([plan(user.id), plan(user.id)]);

    await expect(
      prisma.$transaction(async (tx) => {
        await markLearnerChanged(tx, {
          adaptation: ["rebalance", "pace"],
          adaptationGoalId: plans[0]!.goalId,
          allPlansAdaptation: ["calendar"],
          pendingPace: { factor: 1.2, source: "own" },
          userId: user.id,
        });

        throw new Error("Completion changed nothing");
      }),
    ).rejects.toThrow("Completion changed nothing");

    await Promise.all(
      plans.map((row) =>
        expect(prisma.plan.findUniqueOrThrow({ where: { id: row.id } })).resolves.toStrictEqual(
          row,
        ),
      ),
    );

    await expect(revision(user.id)).resolves.toBe(0n);
  });

  it.each(["calendar", "pace"] as const)(
    "retains sibling samples and reasons when %s commits first",
    async (first) => {
      const user = await userFixture();
      const [one, two] = await Promise.all([plan(user.id), plan(user.id)]);
      const pace = { factor: 1.4, source: "own" };
      const held = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const write = (tx: TransactionClient, kind: "calendar" | "pace") =>
        kind === "calendar"
          ? markLearnerChanged(tx, {
              adaptation: ["rebalance"],
              adaptationGoalId: one.goalId,
              allPlansAdaptation: ["calendar"],
              userId: user.id,
            })
          : markLearnerChanged(tx, {
              adaptation: ["pace"],
              adaptationGoalId: two.goalId,
              pendingPace: pace,
              userId: user.id,
            });

      const winner = prisma.$transaction(async (tx) => {
        await write(tx, first);
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend?.pid ?? 0);
        await release.promise;
      });

      winner.catch((error: unknown) => held.reject(error));
      const pid = await held.promise;

      const waiter = prisma.$transaction((tx) =>
        write(tx, first === "calendar" ? "pace" : "calendar"),
      );

      try {
        await waitForBlockedStatement(pid, /SELECT plan\.id[\s\S]*FOR UPDATE OF plan/u);
      } finally {
        release.resolve(null);
        await Promise.all([winner, waiter]);
      }

      await expect(prisma.plan.findUniqueOrThrow({ where: { id: one.id } })).resolves.toMatchObject(
        { inputVersion: 2, pendingAdaptation: ["calendar", "rebalance"], pendingPace: null },
      );

      await expect(prisma.plan.findUniqueOrThrow({ where: { id: two.id } })).resolves.toMatchObject(
        { inputVersion: 2, pendingAdaptation: ["calendar", "pace"], pendingPace: pace },
      );

      await expect(revision(user.id)).resolves.toBe(2n);
    },
  );

  it("keeps global calendar on both plans when an older plan acknowledgment loses its CAS", async () => {
    const user = await userFixture();
    const [stale, sibling] = await Promise.all([plan(user.id), plan(user.id)]);

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { allPlansAdaptation: ["calendar"], userId: user.id }),
    );

    await expect(
      prisma.$transaction(async (tx) => {
        const marked = await markPlanWrite(tx, stale);
        await acknowledgePlanInputs(tx, { checkedAdaptation: ["calendar"], plan: marked });
      }),
    ).rejects.toThrow(PlanConflictError);

    await Promise.all(
      [stale, sibling].map((row) =>
        expect(prisma.plan.findUniqueOrThrow({ where: { id: row.id } })).resolves.toMatchObject({
          inputVersion: 1,
          pendingAdaptation: ["calendar"],
        }),
      ),
    );

    await expect(revision(user.id)).resolves.toBe(1n);
  });
});

describe(markPlansChanged, () => {
  it("updates dependent owners in one statement rather than one round trip per learner", async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => userFixture()));

    const plans = await Promise.all([
      plan(users[0]!.id),
      plan(users[0]!.id),
      plan(users[1]!.id),
      plan(users[2]!.id),
    ]);

    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markPlansChanged(tx, { planIds: [...plans.map((row) => row.id), plans[0]!.id].toReversed() }),
    );

    expect(statements.filter((query) => /^\s*UPDATE\s+users\b/iu.test(query))).toHaveLength(1);

    await expect(Promise.all(users.map((user) => revision(user.id)))).resolves.toStrictEqual([
      1n,
      1n,
      1n,
      0n,
    ]);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 1, version: 1 })));
  });

  it("locks plans before users across mixed concurrent writers", async () => {
    const [firstUser, secondUser] = await Promise.all([userFixture(), userFixture()]);
    const firstPlan = await plan(firstUser.id);
    const secondPlan = await plan(secondUser.id);
    const locked = Promise.withResolvers<null>();
    const continueFirst = Promise.withResolvers<null>();
    const secondPID = Promise.withResolvers<number>();

    const firstWriter = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${firstPlan.id}::uuid FOR UPDATE`;
      locked.resolve(null);
      await continueFirst.promise;
      return markLearnerChanged(tx, { planInputs: true, userId: firstUser.id });
    });

    await locked.promise;

    const secondWriter = prisma.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;

      if (!backend) {
        throw new Error("Expected transaction backend");
      }

      secondPID.resolve(backend.pid);
      await markPlansChanged(tx, { planIds: [secondPlan.id, firstPlan.id, firstPlan.id] });
      await tx.plan.update({ data: { version: { increment: 1 } }, where: { id: firstPlan.id } });
    });

    const pid = await secondPID.promise;

    try {
      await expect
        .poll(async () => {
          const [backend] = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = ${pid}
        `;

          return backend?.waiting;
        })
        .toBe(true);
    } finally {
      continueFirst.resolve(null);
    }

    await Promise.all([firstWriter, secondWriter]);

    await expect(
      Promise.all([revision(firstUser.id), revision(secondUser.id)]),
    ).resolves.toStrictEqual([2n, 1n]);
  });

  it("serializes overlapping plans in opposite input orders and mixed helper calls", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const [one, two, three] = await Promise.all([plan(first.id), plan(first.id), plan(second.id)]);
    const planIds = [one.id, two.id, three.id];

    await Promise.all([
      prisma.$transaction((tx) => markPlansChanged(tx, { planIds })),
      prisma.$transaction((tx) => markPlansChanged(tx, { planIds: planIds.toReversed() })),
      prisma.$transaction((tx) => markLearnerChanged(tx, { planInputs: true, userId: first.id })),
      prisma.$transaction((tx) => markLearnerChanged(tx, { planInputs: true, userId: second.id })),
    ]);

    await expect(Promise.all([revision(first.id), revision(second.id)])).resolves.toStrictEqual([
      3n,
      3n,
    ]);

    await expect(prisma.plan.findMany({ where: { id: { in: planIds } } })).resolves.toMatchObject(
      planIds.map(() => ({ inputVersion: 3 })),
    );
  });

  it("deduplicates plan owners, includes guests, and returns no revisions", async () => {
    const [first, guest, unaffected] = await Promise.all([
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

    const [one, two, three, other] = await Promise.all([
      plan(first.id),
      plan(first.id),
      plan(guest.id),
      plan(unaffected.id),
    ]);

    await expect(
      prisma.$transaction((tx) =>
        markPlansChanged(tx, { planIds: [one.id, one.id, two.id, three.id] }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      Promise.all([revision(first.id), revision(guest.id), revision(unaffected.id)]),
    ).resolves.toStrictEqual([1n, 1n, 0n]);

    const rows = await prisma.plan.findMany({
      where: { id: { in: [one.id, two.id, three.id, other.id] } },
    });

    const versions = new Map(rows.map((row) => [row.id, row.inputVersion]));
    expect([one, two, three, other].map((row) => versions.get(row.id))).toStrictEqual([1, 1, 1, 0]);

    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [] }));
    await expect(revision(first.id)).resolves.toBe(1n);
    expect(other.id).not.toBe(one.id);
  });

  it("rolls every owner increment back together", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const plans = await Promise.all([plan(first.id), plan(second.id)]);

    await expect(
      prisma.$transaction(async (tx) => {
        await markPlansChanged(tx, { planIds: plans.map((item) => item.id) });
        throw new Error("Roll back shared write");
      }),
    ).rejects.toThrow("Roll back shared write");

    await expect(Promise.all([revision(first.id), revision(second.id)])).resolves.toStrictEqual([
      0n,
      0n,
    ]);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 0 })));
  });
});
