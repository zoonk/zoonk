import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import {
  type NewMemoryFact,
  addMemoryFact,
  removeMemoryFact,
  replaceMemoryFact,
} from "./_utils/memory-writes";
import { deleteMemoryFact } from "./delete-memory-fact";

const MAX_REVISION = 9_223_372_036_854_775_807n;
const WRITERS = ["add", "replace", "remove"] as const;
type Writer = (typeof WRITERS)[number];

function newFact(statement = "Wants Law"): NewMemoryFact {
  return {
    category: "goals",
    confidence: 1,
    expiresAt: null,
    origin: "said",
    provenance: null,
    sensitive: false,
    source: null,
    statement,
  };
}

function write({
  factId,
  statement,
  userId,
  writer,
}: {
  factId: string;
  statement?: string;
  userId: string;
  writer: Writer;
}) {
  if (writer === "add") {
    return addMemoryFact({ fact: newFact(statement), userId });
  }

  if (writer === "replace") {
    return replaceMemoryFact({ fact: newFact(statement), previousId: factId, userId });
  }

  return removeMemoryFact({ factId, userId });
}

async function revision(userId: string) {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return row.learnerRevision;
}

/** Query a real waiter; the test never guesses when the contender has reached its first lock. */
async function waitingQuery(holderPID: number) {
  const state: { query: string | null } = { query: null };

  await vi.waitFor(async () => {
    const [blocked] = await prisma.$queryRaw<{ query: string }[]>`
      SELECT query FROM pg_stat_activity
      WHERE ${holderPID}::int = ANY(pg_blocking_pids(pid))
    `;

    expect(blocked).toBeDefined();
    state.query = blocked?.query ?? null;
  });

  return state.query;
}

describe("memory write learner revisions", () => {
  it.each(WRITERS)("%s bumps once without invalidating plan inputs", async (writer) => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, fact] = await Promise.all([
      planFixture({ goalId: goal.id, inputVersion: 7 }),
      memoryFactFixture({ userId: user.id }),
    ]);

    await expect(write({ factId: fact.id, userId: user.id, writer })).resolves.not.toBeNull();

    await expect(revision(user.id)).resolves.toBe(1n);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: 7,
    });
  });

  it("includes guests and the public delete marks only in the owning helper", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    const added = await addMemoryFact({ fact: newFact(), userId: user.id });
    await expect(revision(user.id)).resolves.toBe(1n);

    const replacement = await replaceMemoryFact({
      fact: newFact("Wants Medicine"),
      previousId: added.id,
      userId: user.id,
    });

    expect(replacement).not.toBeNull();
    await expect(revision(user.id)).resolves.toBe(2n);

    await expect(deleteMemoryFact(replacement!.fact.id)).resolves.toMatchObject({
      status: "deleted",
    });

    await expect(revision(user.id)).resolves.toBe(3n);

    await expect(deleteMemoryFact(replacement!.fact.id)).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(revision(user.id)).resolves.toBe(3n);
  });

  it.each(WRITERS)("%s cannot persist its domain write if the revision fails", async (writer) => {
    const user = await userFixture();
    const fact = await memoryFactFixture({ userId: user.id });
    await prisma.user.update({ data: { learnerRevision: MAX_REVISION }, where: { id: user.id } });

    await expect(write({ factId: fact.id, userId: user.id, writer })).rejects.toThrow();

    await expect(revision(user.id)).resolves.toBe(MAX_REVISION);

    await expect(prisma.memoryFact.findMany({ where: { userId: user.id } })).resolves.toStrictEqual(
      [fact],
    );
  });

  it.each(["add", "replace"] as const)(
    "%s rolls back admission on a real text failure",
    async (writer) => {
      const user = await userFixture();
      const fact = await memoryFactFixture({ userId: user.id });

      /** PostgreSQL rejects NUL in text; this fails the real insert after revision admission. */
      await expect(
        write({ factId: fact.id, statement: "Invalid\u0000text", userId: user.id, writer }),
      ).rejects.toThrow();

      await expect(revision(user.id)).resolves.toBe(0n);

      await expect(
        prisma.memoryFact.findMany({ where: { userId: user.id } }),
      ).resolves.toStrictEqual([fact]);
    },
  );

  it.each(["replace", "remove"] as const)(
    "%s rejects missing, foreign and inactive facts without a bump",
    async (writer) => {
      const [learner, other] = await Promise.all([userFixture(), userFixture()]);

      const [foreign, inactive] = await Promise.all([
        memoryFactFixture({ userId: other.id }),
        memoryFactFixture({ status: "deleted", userId: learner.id }),
      ]);

      await Promise.all(
        [foreign.id, inactive.id, crypto.randomUUID()].map((factId) =>
          expect(write({ factId, userId: learner.id, writer })).resolves.toBeNull(),
        ),
      );

      await expect(revision(learner.id)).resolves.toBe(0n);
      await expect(revision(other.id)).resolves.toBe(0n);
      await expect(prisma.memoryFact.count({ where: { userId: learner.id } })).resolves.toBe(1);
    },
  );

  it.each(["replace", "remove"] as const)(
    "%s locks users first and rolls back a lost race",
    async (writer) => {
      const user = await userFixture();
      const fact = await memoryFactFixture({ userId: user.id });
      const locked = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<null>();

      const first = prisma.$transaction(async (tx) => {
        await markLearnerChanged(tx, { planInputs: false, userId: user.id });
        await tx.$queryRaw`SELECT id FROM memory_facts WHERE id = ${fact.id}::uuid FOR UPDATE`;
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        locked.resolve(backend!.pid);
        await resume.promise;
        await tx.memoryFact.update({ data: { status: "deleted" }, where: { id: fact.id } });
      });

      const pid = await locked.promise;
      const attempt = write({ factId: fact.id, userId: user.id, writer });

      try {
        await expect(waitingQuery(pid)).resolves.toMatch(/UPDATE users SET learner_revision/u);
      } finally {
        resume.resolve(null);
        const outcomes = await Promise.allSettled([first, attempt]);

        for (const outcome of outcomes) {
          expect(outcome.status).toBe("fulfilled");
        }
      }

      await expect(attempt).resolves.toBeNull();
      await expect(revision(user.id)).resolves.toBe(1n);
      await expect(prisma.memoryFact.count({ where: { userId: user.id } })).resolves.toBe(1);

      await expect(
        prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
      ).resolves.toMatchObject({ status: "deleted" });
    },
  );

  it("public delete does not mark unauthorized attempts", async () => {
    const user = await userFixture();
    const fact = await memoryFactFixture({ userId: user.id });
    mockSession(null);

    await expect(deleteMemoryFact(fact.id)).resolves.toStrictEqual({ status: "unauthorized" });
    await expect(revision(user.id)).resolves.toBe(0n);

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toStrictEqual(fact);
  });
});
