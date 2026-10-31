import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { LEARNER_LOCK, waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import {
  type NewMemoryFact,
  addMemoryFact,
  removeMemoryFact,
  replaceMemoryFact,
} from "./_utils/memory-writes";
import { deleteMemoryFact } from "./delete-memory-fact";

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

describe("memory writes under the learner's lock", () => {
  it.each(WRITERS)("%s writes once without invalidating plan inputs", async (writer) => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, fact] = await Promise.all([
      planFixture({ goalId: goal.id, inputVersion: 7 }),
      memoryFactFixture({ userId: user.id }),
    ]);

    await expect(write({ factId: fact.id, userId: user.id, writer })).resolves.not.toBeNull();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: 7,
    });
  });

  it("includes guests and the public delete marks only in the owning helper", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    const added = await addMemoryFact({ fact: newFact(), userId: user.id });

    const replacement = await replaceMemoryFact({
      fact: newFact("Wants Medicine"),
      previousId: added.id,
      userId: user.id,
    });

    expect(replacement).not.toBeNull();

    await expect(deleteMemoryFact(replacement!.fact.id)).resolves.toMatchObject({
      status: "deleted",
    });

    await expect(deleteMemoryFact(replacement!.fact.id)).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it.each(["add", "replace"] as const)(
    "%s rolls back admission on a real text failure",
    async (writer) => {
      const user = await userFixture();
      const fact = await memoryFactFixture({ userId: user.id });

      /** PostgreSQL rejects NUL in text; this fails the real insert after the learner's lock. */
      await expect(
        write({ factId: fact.id, statement: "Invalid\u0000text", userId: user.id, writer }),
      ).rejects.toThrow();

      await expect(
        prisma.memoryFact.findMany({ where: { userId: user.id } }),
      ).resolves.toStrictEqual([fact]);
    },
  );

  it.each(["replace", "remove"] as const)(
    "%s rejects missing, foreign and inactive facts, changing nothing",
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
        await waitForBlockedStatement(pid, LEARNER_LOCK);
      } finally {
        resume.resolve(null);
        const outcomes = await Promise.allSettled([first, attempt]);

        for (const outcome of outcomes) {
          expect(outcome.status).toBe("fulfilled");
        }
      }

      await expect(attempt).resolves.toBeNull();
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

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toStrictEqual(fact);
  });
});
